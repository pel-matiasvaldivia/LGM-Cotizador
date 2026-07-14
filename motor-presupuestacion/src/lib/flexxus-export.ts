import { asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { configuracion, datosTecnicos, presupuestoBaseItems, proyectos } from '@/db/schema'
import { calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'
import { construirLineasFlexxus, generarCsvFlexxus } from '@/lib/flexxus'

export class FlexxusError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Genera el CSV de exportación a Flexxus para un proyecto: computa la cascada
// de precio, asigna el correlativo de proyecto si falta, y arma las líneas por
// rubro/subrubro. Lanza FlexxusError con el status apropiado ante errores.
export async function csvFlexxusDeProyecto(proyectoId: string): Promise<{ csv: string; codigo: string }> {
  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) throw new FlexxusError('Proyecto no encontrado', 404)

  const dt = await db.query.datosTecnicos.findFirst({ where: eq(datosTecnicos.proyectoId, proyectoId) })
  const items = await db.query.presupuestoBaseItems.findMany({
    where: eq(presupuestoBaseItems.proyectoId, proyectoId),
    with: { subrubro: { with: { rubro: true } } },
    orderBy: asc(presupuestoBaseItems.orden),
  })
  if (items.length === 0) throw new FlexxusError('El proyecto no tiene presupuesto calculado', 400)

  // Cascada → markup para llevar el costo a precio de venta (mismo criterio que R-04)
  const params = await getParametros()
  const resumen = calcularResumen(items, params, dt?.superficie ?? 0, proyecto.ubicacion)
  const markup = resumen.costoDirectoUsd ? resumen.totalSinIvaUsd / resumen.costoDirectoUsd : 1

  // Config: código de cliente por defecto y base del correlativo de proyecto
  const cfg = await db.query.configuracion.findMany({
    where: inArray(configuracion.clave, ['codigo_cliente_flexxus', 'flexxus_proyecto_base']),
  })
  const cfgMap = Object.fromEntries(cfg.map((c) => [c.clave, c.valor]))
  const codigoClienteDefault = typeof cfgMap.codigo_cliente_flexxus === 'string' ? cfgMap.codigo_cliente_flexxus : '00000'
  const base = typeof cfgMap.flexxus_proyecto_base === 'number' ? cfgMap.flexxus_proyecto_base : 100

  // Código de proyecto Flexxus: correlativo automático, asignado la primera vez
  let codigoProyecto = proyecto.codigoProyectoFlexxus
  if (codigoProyecto == null) {
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${proyectos.codigoProyectoFlexxus}), ${base})` })
      .from(proyectos)
    codigoProyecto = Number(max) + 1
    await db.update(proyectos).set({ codigoProyectoFlexxus: codigoProyecto }).where(eq(proyectos.id, proyectoId))
  }

  const codigoCliente = proyecto.codigoClienteFlexxus || codigoClienteDefault

  const lineas = construirLineasFlexxus(
    items.map((i) => ({
      descripcion: i.descripcion,
      rubro_nombre: i.subrubro?.rubro?.nombre ?? null,
      costo_material_usd: Number(i.costoMaterialUsd || 0),
      costo_mo_usd: Number(i.costoMoUsd || 0),
    })),
    markup,
    params.tipoCambio,
  )

  return { csv: generarCsvFlexxus(codigoCliente, codigoProyecto, lineas), codigo: proyecto.codigo }
}
