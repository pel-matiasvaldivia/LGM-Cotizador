import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireOrdenDelProyecto } from '@/lib/scope'
import { cerrarOrden } from '@/lib/produccion'

// Cierre de la orden de producción. Sólo con todo entregado y confirmado en
// obra: la regla la hace cumplir cerrarOrden, no esta ruta.

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)
  await cerrarOrden(orden, user)

  return NextResponse.json({ success: true })
})
