import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { presupuestoBaseItems, proyectos } from '@/db/schema'
import { calcularBase0 } from '@/lib/calculator'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { itemToRow } from '@/lib/serializers'

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser()

  const { proyectoId, datosTecnicos } = await req.json()
  if (!isUuid(proyectoId) || !datosTecnicos) {
    return NextResponse.json({ error: 'Faltan parámetros requeridos (proyectoId, datosTecnicos)' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }
  // Un cliente solo puede recalcular sus propios proyectos
  if (user.rol === 'cliente' && proyecto.email?.toLowerCase() !== user.email) {
    return NextResponse.json({ error: 'Sin permisos sobre este proyecto' }, { status: 403 })
  }

  const itemsCalculados = await calcularBase0(proyectoId, datosTecnicos)

  // Delete + insert atómico: si el insert falla no se pierde el presupuesto anterior
  const items = await db.transaction(async (tx) => {
    await tx.delete(presupuestoBaseItems).where(eq(presupuestoBaseItems.proyectoId, proyectoId))
    if (itemsCalculados.length === 0) return []
    return tx.insert(presupuestoBaseItems).values(itemsCalculados).returning()
  })

  // El front espera snake_case (mismo shape que las filas de la tabla)
  return NextResponse.json({ items: items.map(itemToRow) })
})
