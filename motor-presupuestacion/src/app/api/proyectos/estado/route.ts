import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

// Estados válidos del ciclo de vida de un presupuesto. El cliente ve el
// presupuesto (precio + PDF) recién a partir de 'enviado'.
const ESTADOS = ['borrador', 'enviado', 'preaprobado', 'aprobado'] as const
type Estado = (typeof ESTADOS)[number]

// PATCH → cambia el estado de un proyecto. Lo usa el comercial para "enviar el
// presupuesto al cliente" (borrador → enviado) y para avanzar el ciclo.
export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { proyectoId, estado } = await req.json()
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (!ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  await db.update(proyectos)
    .set({ estado: estado as Estado })
    .where(eq(proyectos.id, proyectoId))

  return NextResponse.json({ success: true, estado })
})
