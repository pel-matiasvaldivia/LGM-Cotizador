import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { materialesOrden, ordenesCompra } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { AuthError } from '@/lib/errors'
import { requireOrdenDelProyecto, requireProyecto } from '@/lib/scope'
import { emitirOrdenCompra, marcarOrdenCompraPedida } from '@/lib/produccion'
import { ordenCompraToRow } from '@/lib/serializers'
import { getTenantPorId } from '@/lib/tenant'
import { brandDesdeTenant } from '@/lib/branding'
import { emisorDesdeTenant } from '@/lib/pdf-emisor'
import { generarOrdenCompraPDF } from '@/lib/pdf-produccion'

// Orden de compra de referencia: el pedido de materiales de esta obra.
//
// POST  emite la OC con los faltantes
// PATCH la marca cursada, con la referencia del ERP
// GET   devuelve el PDF para mandar a compras

async function ocDelTenant(ocId: string) {
  const oc = await db.query.ordenesCompra.findFirst({
    where: eq(ordenesCompra.id, ocId),
    with: { items: true },
  })
  if (!oc) throw new AuthError('Orden de compra no encontrada', 404)
  // El tenant se valida subiendo por el proyecto, como todo lo que cuelga de él.
  await requireProyecto(oc.proyectoId)
  return oc
}

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)
  const materialIds = Array.isArray(body.materialIds) ? body.materialIds.filter(isUuid) : undefined

  const oc = await emitirOrdenCompra(
    orden,
    {
      materialIds,
      fechaNecesidad: typeof body.fechaNecesidad === 'string' ? body.fechaNecesidad : '',
      proveedor: typeof body.proveedor === 'string' ? body.proveedor : '',
      notas: typeof body.notas === 'string' ? body.notas : '',
    },
    user,
  )

  const completa = await ocDelTenant(oc.id)
  return NextResponse.json({ success: true, orden_compra: ordenCompraToRow(completa, completa.items) })
})

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.ordenCompraId)) {
    return NextResponse.json({ error: 'Falta ordenCompraId' }, { status: 400 })
  }

  const oc = await ocDelTenant(body.ordenCompraId)
  const orden = await requireOrdenDelProyecto(oc.proyectoId)

  await marcarOrdenCompraPedida(
    orden,
    oc,
    typeof body.referenciaErp === 'string' ? body.referenciaErp : '',
    user,
  )

  const actualizada = await ocDelTenant(oc.id)
  return NextResponse.json({ success: true, orden_compra: ordenCompraToRow(actualizada, actualizada.items) })
})

export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['admin', 'comercial'])

  const ocId = new URL(req.url).searchParams.get('ordenCompraId')
  if (!isUuid(ocId)) {
    return NextResponse.json({ error: 'Falta ordenCompraId' }, { status: 400 })
  }

  const oc = await ocDelTenant(ocId)
  const proyecto = await requireProyecto(oc.proyectoId)
  const orden = await requireOrdenDelProyecto(oc.proyectoId)
  const materiales = await db.query.materialesOrden.findMany({
    where: eq(materialesOrden.ordenId, orden.id),
  })

  const tenant = await getTenantPorId(proyecto.tenantId)
  const emisor = emisorDesdeTenant(tenant, brandDesdeTenant(tenant))
  const buffer = await generarOrdenCompraPDF(oc, materiales, orden, proyecto, emisor)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=${oc.numero}.pdf`,
    },
  })
})
