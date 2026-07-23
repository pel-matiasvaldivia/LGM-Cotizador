import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

// PATCH → edita datos de cabecera del proyecto que el comercial suele necesitar
// corregir (la dirección exacta de la obra: los clientes rara vez la cargan bien).
// Sólo comercial/admin. Devuelve el valor actualizado.
export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const body = await req.json()
  const { proyectoId } = body
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const cambios: Record<string, string> = {}
  if (typeof body.ubicacion === 'string') cambios.ubicacion = body.ubicacion.trim()

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para aplicar' }, { status: 400 })
  }

  await db.update(proyectos).set(cambios).where(eq(proyectos.id, proyectoId))

  return NextResponse.json({ success: true, ...cambios })
})
