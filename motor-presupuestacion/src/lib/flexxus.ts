// lib/flexxus.ts — Integración con ERP Flexxus
//
// Exporta el presupuesto al formato que consume Flexxus (una fila por
// rubro/subrubro con el monto en ARS):
//
//   CodigoCliente,CodigoProyecto,CodigoRubro,CodigoSubRubro,Monto
//
// Los códigos de rubro/subrubro salen del catálogo real de Flexxus
// (46..72). Cada rubro del cotizador se mapea a su rubro Flexxus y su costo
// se separa en Materiales / Mano de Obra, ruteando cada parte al subrubro
// correspondiente (p. ej. Estructura → 349 Materiales / 347 MO Fabricación).

// Códigos de subrubro por naturaleza de costo, por rubro Flexxus.
// subMoFab / subMoMontaje distinguen Mano de Obra de Fabricación vs Montaje;
// en rubros con una sola MO ambos apuntan al mismo subrubro.
interface MapeoRubro {
  codigoRubro: number
  subMaterial: number // subrubro de Materiales
  subMoFab: number // subrubro de MO Fabricación (o MO genérica)
  subMoMontaje: number // subrubro de MO Montaje (o MO genérica)
}

// Clave = nombre normalizado del rubro del cotizador. Cobertura completa de los
// rubros vigentes de Flexxus (46..72) para que cualquier rubro cargado (manual
// o vía importador de Base 0) exporte con sus códigos correctos.
export const MAPEO_FLEXXUS: Record<string, MapeoRubro> = {
  'honorarios': { codigoRubro: 46, subMaterial: 333, subMoFab: 333, subMoMontaje: 333 },
  'preliminares': { codigoRubro: 47, subMaterial: 339, subMoFab: 338, subMoMontaje: 338 },
  'movimiento de suelo': { codigoRubro: 48, subMaterial: 343, subMoFab: 341, subMoMontaje: 341 },
  'fundaciones': { codigoRubro: 49, subMaterial: 346, subMoFab: 345, subMoMontaje: 345 },
  'estructura metalica': { codigoRubro: 50, subMaterial: 349, subMoFab: 347, subMoMontaje: 348 },
  'cerramiento lateral': { codigoRubro: 51, subMaterial: 352, subMoFab: 350, subMoMontaje: 351 },
  'cerramiento cubierta': { codigoRubro: 52, subMaterial: 354, subMoFab: 353, subMoMontaje: 353 },
  'portones': { codigoRubro: 53, subMaterial: 357, subMoFab: 355, subMoMontaje: 356 },
  'escaleras': { codigoRubro: 54, subMaterial: 360, subMoFab: 358, subMoMontaje: 359 },
  'aleros': { codigoRubro: 55, subMaterial: 363, subMoFab: 361, subMoMontaje: 362 },
  'zingueria': { codigoRubro: 56, subMaterial: 366, subMoFab: 364, subMoMontaje: 365 },
  'cenefa': { codigoRubro: 57, subMaterial: 369, subMoFab: 367, subMoMontaje: 368 },
  'piso industrial': { codigoRubro: 58, subMaterial: 371, subMoFab: 370, subMoMontaje: 370 },
  'veredin': { codigoRubro: 59, subMaterial: 373, subMoFab: 372, subMoMontaje: 372 },
  'tabiques livianos y cielorraso': { codigoRubro: 60, subMaterial: 375, subMoFab: 374, subMoMontaje: 374 },
  'carpinterias': { codigoRubro: 61, subMaterial: 377, subMoFab: 376, subMoMontaje: 376 },
  'revestimientos': { codigoRubro: 62, subMaterial: 379, subMoFab: 378, subMoMontaje: 378 },
  'instalacion sanitaria': { codigoRubro: 63, subMaterial: 380, subMoFab: 381, subMoMontaje: 381 },
  'instalacion electrica': { codigoRubro: 64, subMaterial: 384, subMoFab: 383, subMoMontaje: 383 },
  'sistema contra incendios': { codigoRubro: 65, subMaterial: 386, subMoFab: 385, subMoMontaje: 385 },
  'instalacion termomecanica': { codigoRubro: 66, subMaterial: 389, subMoFab: 388, subMoMontaje: 388 },
  'obra civil': { codigoRubro: 67, subMaterial: 391, subMoFab: 390, subMoMontaje: 390 },
  'estructura secundaria': { codigoRubro: 68, subMaterial: 393, subMoFab: 392, subMoMontaje: 394 },
  'entrepiso': { codigoRubro: 68, subMaterial: 393, subMoFab: 392, subMoMontaje: 394 },
  'montaje': { codigoRubro: 50, subMaterial: 348, subMoFab: 348, subMoMontaje: 348 },
  'final de obra': { codigoRubro: 70, subMaterial: 399, subMoFab: 399, subMoMontaje: 400 },
}

// Rubro Flexxus para la logística/flete (ítems sintéticos sin rubro del catálogo).
const FLETE_FLEXXUS: MapeoRubro = { codigoRubro: 69, subMaterial: 397, subMoFab: 397, subMoMontaje: 397 }

function normalizar(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// Resuelve el mapeo Flexxus de un ítem por el nombre de su rubro; si es un
// flete (sin rubro), usa el rubro de logística.
function mapeoDeItem(item: FlexxusItemInput): MapeoRubro {
  const rubro = normalizar(item.rubro_nombre || '')
  if (MAPEO_FLEXXUS[rubro]) return MAPEO_FLEXXUS[rubro]
  if (normalizar(item.descripcion || '').includes('flete')) return FLETE_FLEXXUS
  // Sin match: cae en Costos Indirectos / Otros para no perder el monto.
  return { codigoRubro: 71, subMaterial: 403, subMoFab: 403, subMoMontaje: 403 }
}

export interface FlexxusItemInput {
  descripcion: string
  rubro_nombre?: string | null
  costo_material_usd: number
  costo_mo_usd: number
  // Opcionales: si el ítem trae la MO ya separada (p. ej. desde el importador
  // de Base 0), se rutea Fabricación y Montaje a subrubros distintos. Si no,
  // la MO combinada va al subrubro de Fabricación.
  costo_mo_fab_usd?: number
  costo_mo_montaje_usd?: number
}

export interface LineaFlexxus {
  codigoRubro: number
  codigoSubrubro: number
  montoArs: number
}

// Agrega los ítems del presupuesto en líneas Flexxus (ARS), separando
// Materiales y Mano de Obra y aplicando el markup de la cascada (precio de venta).
export function construirLineasFlexxus(
  items: FlexxusItemInput[],
  markup: number,
  tipoCambio: number,
): LineaFlexxus[] {
  const acum = new Map<string, LineaFlexxus>()
  const sumar = (codigoRubro: number, codigoSubrubro: number, montoUsd: number) => {
    if (!(montoUsd > 0)) return
    const key = `${codigoRubro}-${codigoSubrubro}`
    const montoArs = montoUsd * markup * tipoCambio
    const prev = acum.get(key)
    if (prev) prev.montoArs += montoArs
    else acum.set(key, { codigoRubro, codigoSubrubro, montoArs })
  }

  for (const item of items) {
    const m = mapeoDeItem(item)
    sumar(m.codigoRubro, m.subMaterial, Number(item.costo_material_usd || 0))

    const fab = Number(item.costo_mo_fab_usd || 0)
    const montaje = Number(item.costo_mo_montaje_usd || 0)
    if (fab > 0 || montaje > 0) {
      // MO ya separada (importador): rutea Fabricación y Montaje por separado.
      sumar(m.codigoRubro, m.subMoFab, fab)
      sumar(m.codigoRubro, m.subMoMontaje, montaje)
    } else {
      // MO combinada: va al subrubro de Fabricación del rubro.
      sumar(m.codigoRubro, m.subMoFab, Number(item.costo_mo_usd || 0))
    }
  }

  return Array.from(acum.values()).sort(
    (a, b) => a.codigoRubro - b.codigoRubro || a.codigoSubrubro - b.codigoSubrubro,
  )
}

// Zero-pad al ancho del formato Flexxus (rubro 3 dígitos, subrubro 3 dígitos).
function pad(n: number, ancho: number): string {
  return String(n).padStart(ancho, '0')
}

// Genera el CSV con el formato exacto que importa Flexxus.
export function generarCsvFlexxus(
  codigoCliente: string,
  codigoProyecto: number,
  lineas: LineaFlexxus[],
): string {
  const header = 'CodigoCliente,CodigoProyecto,CodigoRubro,CodigoSubRubro,Monto'
  const filas = lineas.map((l) =>
    [
      codigoCliente,
      String(codigoProyecto),
      pad(l.codigoRubro, 3),
      pad(l.codigoSubrubro, 3),
      Math.round(l.montoArs),
    ].join(','),
  )
  return [header, ...filas].join('\n')
}
