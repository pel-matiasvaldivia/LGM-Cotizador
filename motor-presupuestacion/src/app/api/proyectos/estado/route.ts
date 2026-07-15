import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { linkReunion, notificarPreaprobacion, notificarPresupuestoEnviado } from '@/lib/notificaciones'

// Ciclo de vida de un presupuesto. El cliente ve el presupuesto (precio + PDF)
// recién a partir de 'enviado'.
const ESTADOS = ['borrador', 'enviado', 'preaprobado', 'aprobado'] as const
type Estado = (typeof ESTADOS)[number]

// PATCH → cambia el estado de un proyecto.
//  - El comercial/admin puede llevarlo a cualquier estado (típicamente
//    borrador → enviado para "enviar el presupuesto al cliente").
//  - El cliente dueño sólo puede pre-aprobar (enviado → preaprobado), lo que
//    dispara la coordinación de la reunión con el equipo comercial.
export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser()

  const { proyectoId, estado } = await req.json()
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (!ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const esStaff = user.rol === 'comercial' || user.rol === 'admin'
  if (!esStaff) {
    // El cliente sólo puede pre-aprobar su propio presupuesto ya enviado.
    const propio = proyecto.email && proyecto.email.toLowerCase() === user.email.toLowerCase()
    const transicionValida = estado === 'preaprobado' && proyecto.estado === 'enviado'
    if (!propio || !transicionValida) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  await db.update(proyectos)
    .set({ estado: estado as Estado })
    .where(eq(proyectos.id, proyectoId))

  const actualizado = { ...proyecto, estado: estado as Estado }

  // Disparadores de notificación según el nuevo estado.
  if (estado === 'enviado') {
    await notificarPresupuestoEnviado(actualizado)
  } else if (estado === 'preaprobado') {
    await notificarPreaprobacion(actualizado)
    return NextResponse.json({ success: true, estado, reunionUrl: linkReunion(actualizado) })
  }

  return NextResponse.json({ success: true, estado })
})
