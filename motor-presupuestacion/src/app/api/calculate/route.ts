import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos as datosTecnicosTable, presupuestoBaseItems, proyectos } from '@/db/schema'
import { calcularBase0, calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'
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

  // Persiste la distancia a obra (para que la logística se recalcule igual la próxima vez)
  const distanciaKm = Number(datosTecnicos.distancia_obra_km)
  if (Number.isFinite(distanciaKm) && distanciaKm >= 0) {
    await db
      .update(datosTecnicosTable)
      .set({ distanciaObraKm: distanciaKm })
      .where(eq(datosTecnicosTable.proyectoId, proyectoId))
  }

  const itemsCalculados = await calcularBase0(proyectoId, datosTecnicos)

  // Delete + insert atómico: si el insert falla no se pierde el presupuesto anterior
  const items = await db.transaction(async (tx) => {
    await tx.delete(presupuestoBaseItems).where(eq(presupuestoBaseItems.proyectoId, proyectoId))
    if (itemsCalculados.length === 0) return []
    return tx.insert(presupuestoBaseItems).values(itemsCalculados).returning()
  })

  // Cascada de costeo (directo → indirectos → beneficio → IVA) con parámetros globales
  const params = await getParametros()
  const superficie = Number(datosTecnicos.superficie_m2 ?? datosTecnicos.superficie ?? 0)
  const resumen = calcularResumen(items, params, superficie, proyecto.ubicacion)

  // El front espera snake_case (mismo shape que las filas de la tabla)
  return NextResponse.json({ items: items.map(itemToRow), resumen })
})
