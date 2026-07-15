import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos as datosTecnicosTable, presupuestoBaseItems, proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { itemToRow } from '@/lib/serializers'
import { calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'

// Recalcula incidencias, arma el resumen y devuelve items + resumen del proyecto.
async function estadoProyecto(proyectoId: string) {
  const items = await db.query.presupuestoBaseItems.findMany({
    where: eq(presupuestoBaseItems.proyectoId, proyectoId),
    with: { rubro: true, subrubro: true },
    orderBy: asc(presupuestoBaseItems.orden),
  })
  const totalDirecto = items.reduce((s, i) => s + (i.costoTotalUsd || 0), 0)
  if (totalDirecto > 0) {
    for (const it of items) {
      const inc = (it.costoTotalUsd || 0) / totalDirecto
      if (Math.abs(inc - (it.incidencia || 0)) > 1e-9) {
        await db.update(presupuestoBaseItems).set({ incidencia: inc }).where(eq(presupuestoBaseItems.id, it.id))
        it.incidencia = inc
      }
    }
  }
  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  const dt = await db.query.datosTecnicos.findFirst({ where: eq(datosTecnicosTable.proyectoId, proyectoId) })
  const params = await getParametros()
  const resumen = calcularResumen(items, params, dt?.superficie ?? 0, proyecto?.ubicacion)
  return { items: items.map(itemToRow), resumen }
}

// POST → agrega un ítem manual al presupuesto (origen 'manual', sobrevive al
// recálculo). Recibe costos unitarios (por unidad); calcula los totales.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])
  const body = await req.json()
  const { proyectoId, descripcion, unidad } = body
  if (!isUuid(proyectoId) || !descripcion) {
    return NextResponse.json({ error: 'Faltan datos (proyectoId, descripcion)' }, { status: 400 })
  }
  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const cantidad = Math.max(Number(body.cantidad) || 0, 0)
  const unitMat = Math.max(Number(body.costoUnitMaterialUsd) || 0, 0)
  const unitMo = Math.max(Number(body.costoUnitMoUsd) || 0, 0)
  const params = await getParametros()
  const tc = params.tipoCambio || 1

  const costoMaterialUsd = cantidad * unitMat
  const costoMoUsd = cantidad * unitMo
  const costoTotalUsd = costoMaterialUsd + costoMoUsd
  const precioUnitarioUsd = unitMat + unitMo

  const existentes = await db.query.presupuestoBaseItems.findMany({
    where: eq(presupuestoBaseItems.proyectoId, proyectoId),
    columns: { orden: true },
  })
  const orden = existentes.reduce((m, i) => Math.max(m, i.orden || 0), 0) + 1

  await db.insert(presupuestoBaseItems).values({
    proyectoId,
    rubroId: isUuid(body.rubroId) ? body.rubroId : null,
    subrubroId: isUuid(body.subrubroId) ? body.subrubroId : null,
    descripcion: String(descripcion),
    unidad: String(unidad || ''),
    cantidad,
    precioUnitarioArs: precioUnitarioUsd * tc,
    precioUnitarioUsd,
    costoMaterialUsd,
    costoMoUsd,
    costoTotalArs: costoTotalUsd * tc,
    costoTotalUsd,
    precioVentaArs: costoTotalUsd * tc,
    precioVentaUsd: costoTotalUsd,
    incluido: true,
    origen: 'manual',
    orden,
  })

  return NextResponse.json(await estadoProyecto(proyectoId))
})

// DELETE ?id=... → elimina un ítem manual. Los ítems 'base0' se regeneran en el
// recálculo, así que sólo se permite borrar los agregados manualmente.
export const DELETE = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])
  const id = new URL(req.url).searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const item = await db.query.presupuestoBaseItems.findFirst({ where: eq(presupuestoBaseItems.id, id!) })
  if (!item) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  if (item.origen !== 'manual') {
    return NextResponse.json({ error: 'Sólo se pueden eliminar ítems agregados manualmente' }, { status: 400 })
  }

  await db.delete(presupuestoBaseItems).where(eq(presupuestoBaseItems.id, id!))
  return NextResponse.json(await estadoProyecto(item.proyectoId))
})
