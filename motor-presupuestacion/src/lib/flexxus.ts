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
interface MapeoRubro {
  codigoRubro: number
  subMaterial: number // subrubro de Materiales
  subMo: number // subrubro de Mano de Obra (fab/montaje/genérica)
}

// Clave = nombre normalizado del rubro del cotizador.
export const MAPEO_FLEXXUS: Record<string, MapeoRubro> = {
  'honorarios': { codigoRubro: 46, subMaterial: 333, subMo: 333 },
  'preliminares': { codigoRubro: 47, subMaterial: 339, subMo: 338 },
  'movimiento de suelo': { codigoRubro: 48, subMaterial: 343, subMo: 341 },
  'fundaciones': { codigoRubro: 49, subMaterial: 346, subMo: 345 },
  'estructura metalica': { codigoRubro: 50, subMaterial: 349, subMo: 347 },
  'cerramiento lateral': { codigoRubro: 51, subMaterial: 352, subMo: 350 },
  'cerramiento cubierta': { codigoRubro: 52, subMaterial: 354, subMo: 353 },
  'portones': { codigoRubro: 53, subMaterial: 357, subMo: 355 },
  'zingueria': { codigoRubro: 56, subMaterial: 366, subMo: 364 },
  'piso industrial': { codigoRubro: 58, subMaterial: 371, subMo: 370 },
  'veredin': { codigoRubro: 59, subMaterial: 373, subMo: 372 },
  'instalacion sanitaria': { codigoRubro: 63, subMaterial: 380, subMo: 381 },
  'instalacion electrica': { codigoRubro: 64, subMaterial: 384, subMo: 383 },
  'montaje': { codigoRubro: 50, subMaterial: 348, subMo: 348 },
  'final de obra': { codigoRubro: 70, subMaterial: 399, subMo: 399 },
}

// Rubro Flexxus para la logística/flete (ítems sintéticos sin rubro del catálogo).
const FLETE_FLEXXUS: MapeoRubro = { codigoRubro: 69, subMaterial: 397, subMo: 397 }

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
  return { codigoRubro: 71, subMaterial: 403, subMo: 403 }
}

export interface FlexxusItemInput {
  descripcion: string
  rubro_nombre?: string | null
  costo_material_usd: number
  costo_mo_usd: number
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
    sumar(m.codigoRubro, m.subMo, Number(item.costo_mo_usd || 0))
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
