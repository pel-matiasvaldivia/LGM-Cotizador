import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireProyecto } from '@/lib/scope'
import { AuthError } from '@/lib/errors'
import { getTenantPorId } from '@/lib/tenant'
import { brandDesdeTenant } from '@/lib/branding'
import { emisorDesdeTenant } from '@/lib/pdf-emisor'
import { generarOrdenProduccionPDF } from '@/lib/pdf-cierre'
import {
  emitirOrdenProduccion, getContrato, getOrdenProduccion, normalizarDatosOrden,
} from '@/lib/cierre'
import { notificarOrdenProduccion } from '@/lib/notificaciones'
import { ordenToRow } from '@/lib/serializers'

// Orden de producción: lo que recibe oficina técnica para empezar. Sale del
// contrato firmado y nunca antes (la regla la hace cumplir emitirOrdenProduccion).
//
// Es un documento interno: muestra costos de mano de obra, así que acá no entra
// el cliente, sólo el staff.

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await requireProyecto(body.proyectoId)
  const orden = await emitirOrdenProduccion(proyecto, normalizarDatosOrden(body), user.id)

  await notificarOrdenProduccion({ ...proyecto, estado: 'produccion' }, orden)

  return NextResponse.json({ success: true, orden: ordenToRow(orden) })
})

export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['admin', 'comercial'])

  const proyectoId = new URL(req.url).searchParams.get('proyectoId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await requireProyecto(proyectoId)

  const orden = await getOrdenProduccion(proyecto.id)
  if (!orden) throw new AuthError('No hay orden de producción emitida', 404)

  const contrato = await getContrato(proyecto.id)
  const tenant = await getTenantPorId(proyecto.tenantId)
  const emisor = emisorDesdeTenant(tenant, brandDesdeTenant(tenant))
  const buffer = await generarOrdenProduccionPDF(orden, contrato ?? null, proyecto, emisor)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=${orden.numero}.pdf`,
    },
  })
})
