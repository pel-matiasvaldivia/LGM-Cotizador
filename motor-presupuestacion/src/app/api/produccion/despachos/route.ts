import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { despachos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { AuthError } from '@/lib/errors'
import { requireOrdenDelProyecto, requireProyecto } from '@/lib/scope'
import { crearDespacho, marcarEnTransito, registrarRecepcionObra } from '@/lib/produccion'
import { despachoToRow } from '@/lib/serializers'
import { getTenantPorId } from '@/lib/tenant'
import { brandDesdeTenant } from '@/lib/branding'
import { emisorDesdeTenant } from '@/lib/pdf-emisor'
import { generarRemitoPDF } from '@/lib/pdf-produccion'

// Despacho a obra y control de llegada (logística y obra).
//
// POST  arma el remito con las partes terminadas
// PATCH marca la salida del camión, o registra la recepción en la obra
// GET   devuelve el remito en PDF para que viaje con el transporte

const CONFORMIDADES = ['conforme', 'con_observaciones', 'rechazado'] as const

async function despachoDelTenant(despachoId: string) {
  const despacho = await db.query.despachos.findFirst({
    where: eq(despachos.id, despachoId),
    with: { items: true },
  })
  if (!despacho) throw new AuthError('Despacho no encontrado', 404)
  await requireProyecto(despacho.proyectoId)
  return despacho
}

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'El remito no tiene renglones' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)

  const despacho = await crearDespacho(
    orden,
    {
      items: body.items.map((i: Record<string, unknown>) => ({
        parteId: isUuid(i?.parteId) ? (i.parteId as string) : null,
        descripcion: typeof i?.descripcion === 'string' ? i.descripcion : '',
        cantidad: Number(i?.cantidad),
        unidad: typeof i?.unidad === 'string' ? i.unidad : 'un',
      })),
      fechaSalida: typeof body.fechaSalida === 'string' ? body.fechaSalida : '',
      transporte: typeof body.transporte === 'string' ? body.transporte : '',
      chofer: typeof body.chofer === 'string' ? body.chofer : '',
      patente: typeof body.patente === 'string' ? body.patente : '',
      destino: typeof body.destino === 'string' ? body.destino : '',
      observaciones: typeof body.observaciones === 'string' ? body.observaciones : '',
    },
    user,
  )

  const completo = await despachoDelTenant(despacho.id)
  return NextResponse.json({ success: true, despacho: despachoToRow(completo, completo.items) })
})

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.despachoId)) {
    return NextResponse.json({ error: 'Falta despachoId' }, { status: 400 })
  }

  const despacho = await despachoDelTenant(body.despachoId)
  const orden = await requireOrdenDelProyecto(despacho.proyectoId)

  if (body.accion === 'despachar') {
    await marcarEnTransito(orden, despacho, user)
  } else if (body.accion === 'recibir') {
    if (!CONFORMIDADES.includes(body.conformidad)) {
      return NextResponse.json({ error: 'Conformidad inválida' }, { status: 400 })
    }
    await registrarRecepcionObra(
      orden,
      despacho,
      {
        recibidoPor: String(body.recibidoPor ?? ''),
        conformidad: body.conformidad,
        observaciones: typeof body.observaciones === 'string' ? body.observaciones : '',
        documentoId: isUuid(body.documentoId) ? body.documentoId : null,
        items: Array.isArray(body.items)
          ? body.items
              .filter((i: Record<string, unknown>) => isUuid(i?.itemId))
              .map((i: Record<string, unknown>) => ({
                itemId: i.itemId as string,
                cantidadRecibida: Number(i.cantidadRecibida),
                observaciones: typeof i.observaciones === 'string' ? i.observaciones : '',
              }))
          : undefined,
      },
      user,
    )
  } else {
    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  }

  const actualizado = await despachoDelTenant(despacho.id)
  return NextResponse.json({ success: true, despacho: despachoToRow(actualizado, actualizado.items) })
})

export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['admin', 'comercial'])

  const despachoId = new URL(req.url).searchParams.get('despachoId')
  if (!isUuid(despachoId)) {
    return NextResponse.json({ error: 'Falta despachoId' }, { status: 400 })
  }

  const despacho = await despachoDelTenant(despachoId)
  const proyecto = await requireProyecto(despacho.proyectoId)
  const orden = await requireOrdenDelProyecto(despacho.proyectoId)

  const tenant = await getTenantPorId(proyecto.tenantId)
  const emisor = emisorDesdeTenant(tenant, brandDesdeTenant(tenant))
  const buffer = await generarRemitoPDF(despacho, orden, proyecto, emisor)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=${despacho.numero}.pdf`,
    },
  })
})
