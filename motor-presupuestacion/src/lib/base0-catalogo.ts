// lib/base0-catalogo.ts — Aplica un preview de Base 0 al catálogo de ratios.
//
// Toma el PreviewBase0 (ver base0-import) y lo persiste como catálogo vigente:
// por cada rubro de la planilla, reemplaza sus subrubros/ratios por un ratio
// representativo por m² con el desglose real Material / MO Fabricación / MO
// Montaje. La operación es idempotente: reimportar sobreescribe esos rubros y
// deja intactos los que no aparecen en la planilla.
//
// Los ítems de presupuestos ya emitidos referencian subrubros con ON DELETE SET
// NULL, así que reemplazar el catálogo no altera cotizaciones históricas
// (conservan sus costos congelados; sólo pierden el vínculo al subrubro).

import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { rubros, subrubros, ratiosCostos } from '@/db/schema'
import { getParametros } from '@/lib/parametros'
import { resolverMapeoRubro, normalizar } from '@/lib/flexxus'
import type { PreviewBase0, RubroImportado } from '@/lib/base0-import'

export interface ResultadoAplicar {
  rubrosCreados: number
  rubrosActualizados: number
  subrubros: number
}

// Tipo de la transacción tal como la entrega drizzle en el callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Nombre canónico para mostrar en el catálogo (Title Case a partir del original).
function tituloRubro(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .trim()
}

// `existentes`: rubros ya en el catálogo (id + nombre) para hacer el match
// insensible a mayúsculas Y acentos (la planilla suele venir sin tildes:
// "ESTRUCTURA METALICA" debe reconocer "Estructura Metálica" del catálogo).
async function upsertRubro(
  tx: Tx,
  imp: RubroImportado,
  orden: number,
  existentes: Array<{ id: string; nombre: string }>,
): Promise<{ id: string; creado: boolean; nombre: string }> {
  const codigo = imp.codigoFlexxus ?? 0
  const claveImp = normalizar(imp.nombreOriginal)
  const match = existentes.find((r) => normalizar(r.nombre) === claveImp)

  if (match) {
    // Conserva el nombre canónico del catálogo; sólo actualiza código y ratios.
    await tx.update(rubros).set({ codigoFlexxus: codigo }).where(eq(rubros.id, match.id))
    await tx.delete(subrubros).where(eq(subrubros.rubroId, match.id)) // cascade borra ratios
    return { id: match.id, creado: false, nombre: match.nombre }
  }

  const nombre = tituloRubro(imp.nombreOriginal)
  const [creado] = await tx
    .insert(rubros)
    .values({ nombre, orden, codigoFlexxus: codigo })
    .returning({ id: rubros.id })
  return { id: creado.id, creado: true, nombre }
}

export async function aplicarBase0(preview: PreviewBase0): Promise<ResultadoAplicar> {
  const { tipoCambio } = await getParametros()
  let rubrosCreados = 0
  let rubrosActualizados = 0
  let nSubrubros = 0

  await db.transaction(async (tx) => {
    // Orden inicial: continúa después del máximo actual.
    const [{ maxOrden }] = await tx
      .select({ maxOrden: sql<number>`coalesce(max(${rubros.orden}), 0)` })
      .from(rubros)
    let orden = Number(maxOrden)

    // Rubros existentes para el match insensible a acentos/mayúsculas.
    const existentes = await tx.select({ id: rubros.id, nombre: rubros.nombre }).from(rubros)

    for (const imp of preview.rubros) {
      const mapeo = imp.rubroCatalogo ? resolverMapeoRubro(imp.rubroCatalogo) : null
      const { id, creado, nombre } = await upsertRubro(tx, imp, ++orden, existentes)
      if (creado) rubrosCreados++
      else rubrosActualizados++

      const material = round2(imp.materialUsdM2)
      const moFab = round2(imp.moFabUsdM2)
      const moMontaje = round2(imp.moMontajeUsdM2)
      const mo = round2(moFab + moMontaje)
      const total = round2(material + mo)

      const [sub] = await tx
        .insert(subrubros)
        .values({
          rubroId: id,
          nombre: `${nombre} (Base 0)`,
          codigoFlexxus: mapeo ? mapeo.subMaterial : 0,
        })
        .returning({ id: subrubros.id })

      await tx.insert(ratiosCostos).values({
        subrubroId: sub.id,
        unidad: 'm2',
        ratioCantidad: 1,
        precioMaterialUsd: material,
        precioMoUsd: mo,
        precioMoFabUsd: moFab,
        precioMoMontajeUsd: moMontaje,
        precioUnitarioUsd: total,
        precioUnitarioArs: round2(total * tipoCambio),
      })
      nSubrubros++
    }
  })

  return { rubrosCreados, rubrosActualizados, subrubros: nSubrubros }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
