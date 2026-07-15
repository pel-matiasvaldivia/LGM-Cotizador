// lib/precios-referencia-import.ts — Parser de la hoja de costos unitarios
// (Revista Cifras / "Hoja2" del modelo de costos) hacia la biblioteca de
// precios de referencia.
//
// Estructura de la hoja (columnas 0-based sobre las filas de xlsx-lite):
//   B(1) = código        C(2) = descripción     E(4) = unidad
//   F(5) = costo material  G(6) = costo ejecución  H(7) = costo total
//
// Filas de categoría: B es un entero (00..20) y C tiene el nombre de la sección.
// Filas de ítem: B tiene la forma "NN.NN" y hay unidad; se toma su costo.

export interface PrecioRefImportado {
  categoria: string
  codigo: string
  descripcion: string
  unidad: string
  costoMaterialUsd: number
  costoEjecucionUsd: number
  costoTotalUsd: number
}

export interface PreviewPreciosReferencia {
  items: PrecioRefImportado[]
  categorias: Array<{ nombre: string; cantidad: number }>
}

type Celda = string | number | null
type Fila = Celda[]

function texto(v: Celda): string {
  return v == null ? '' : String(v).trim()
}

function num(v: Celda): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const RE_CATEGORIA = /^\d{1,2}$/
const RE_CODIGO_ITEM = /^\d{1,2}\.\d{1,2}$/

export function parsearPreciosReferencia(filas: Fila[]): PreviewPreciosReferencia {
  const items: PrecioRefImportado[] = []
  let categoria = ''

  for (const fila of filas) {
    const codigo = texto(fila[1])
    const desc = texto(fila[2])
    const unidad = texto(fila[4])

    // Encabezado de sección: código entero + nombre de categoría.
    if (RE_CATEGORIA.test(codigo) && desc) {
      categoria = desc
      continue
    }

    // Ítem con precio: código "NN.NN" y unidad presente.
    if (RE_CODIGO_ITEM.test(codigo) && unidad) {
      const material = num(fila[5])
      const ejecucion = num(fila[6])
      const totalCelda = num(fila[7])
      const total = totalCelda > 0 ? totalCelda : material + ejecucion
      if (total <= 0) continue
      items.push({
        categoria,
        codigo,
        descripcion: desc,
        unidad,
        costoMaterialUsd: redondear(material),
        costoEjecucionUsd: redondear(ejecucion),
        costoTotalUsd: redondear(total),
      })
    }
  }

  const conteo = new Map<string, number>()
  for (const it of items) conteo.set(it.categoria, (conteo.get(it.categoria) || 0) + 1)
  const categorias = Array.from(conteo, ([nombre, cantidad]) => ({ nombre, cantidad }))

  return { items, categorias }
}

function redondear(n: number): number {
  return Math.round(n * 10000) / 10000
}
