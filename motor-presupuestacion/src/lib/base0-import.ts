// lib/base0-import.ts — Interpreta la planilla "BASE 0" a un preview de ratios.
//
// La Base 0 de LOG METAL organiza el costo en rubros numerados ("5. ESTRUCTURA
// METALICA") con subrubros que separan la naturaleza del costo por m²:
// MATERIAL / MO FABRICACIÓN / MO MONTAJE (y variantes MO, ARTEFACTOS, etc.).
//
// Este módulo es lógica pura: recibe la matriz de filas de una hoja (ver
// xlsx-lite) y produce un preview mapeado al catálogo Flexxus, sin tocar la DB.
// El preview se revisa en la UI antes de aplicarlo (base0-catalogo).

import { resolverMapeoRubro, normalizar } from './flexxus'

export type TipoCosto = 'material' | 'mo_fab' | 'mo_montaje' | 'mo'

export interface SubrubroImportado {
  nombre: string
  tipo: TipoCosto
  valorUsdM2: number
}

export interface RubroImportado {
  nombreOriginal: string // tal cual aparece en la planilla (sin el número)
  rubroCatalogo: string | null // nombre canónico si mapea a Flexxus
  codigoFlexxus: number | null
  materialUsdM2: number
  moFabUsdM2: number
  moMontajeUsdM2: number
  totalUsdM2: number
  subrubros: SubrubroImportado[]
}

export interface PreviewBase0 {
  rubros: RubroImportado[]
  sinMapear: string[] // rubros con valores pero sin código Flexxus
  advertencias: string[]
}

// Sinónimos: nombres como aparecen en la Base 0 → clave canónica del catálogo
// Flexxus (ver MAPEO_FLEXXUS). Sólo hace falta para los que no coinciden por
// normalización directa.
const SINONIMOS: Record<string, string> = {
  'estructura principal': 'estructura metalica',
  'estructura metalica': 'estructura metalica',
  'logistica y equipos': 'flete',
  'costos indirectos de obra': 'indirectos',
  'costos comerciales y financieros': 'comerciales',
  'tabiques livianos y cielorraso': 'tabiques livianos y cielorraso',
  'instalacion termomecanica': 'instalacion termomecanica',
  'sistema contra incendios': 'sistema contra incendios',
}

// Rubros cuyo costo es esencialmente mano de obra / servicios: un subrubro sin
// etiqueta clara de naturaleza se interpreta como MO (no material).
const RUBROS_MO = new Set(['honorarios', 'final de obra', 'preliminares'])

// Reconoce una fila de encabezado de rubro: primera celda "N. NOMBRE".
function esFilaRubro(celdas: Array<string | number | null>): string | null {
  const a = celdas[0]
  if (typeof a !== 'string') return null
  const m = /^\s*\d+\s*[.\-)]\s*(.+?)\s*$/.exec(a)
  return m ? m[1].trim() : null
}

// Primer valor numérico de la fila (el USD/m² del subrubro).
function primerNumero(celdas: Array<string | number | null>): number | null {
  for (const c of celdas) {
    if (typeof c === 'number' && Number.isFinite(c)) return c
    if (typeof c === 'string') {
      const n = Number(c.replace(/[.\s]/g, '').replace(',', '.'))
      if (c.trim() !== '' && Number.isFinite(n) && /\d/.test(c)) return n
    }
  }
  return null
}

// Etiqueta del subrubro: primera celda de texto no numérica.
function etiquetaDe(celdas: Array<string | number | null>): string {
  for (const c of celdas) {
    if (typeof c === 'string' && c.trim() !== '') return c.trim()
  }
  return ''
}

// Clasifica la naturaleza del costo por la etiqueta del subrubro.
function clasificar(etiqueta: string, esRubroMo: boolean): TipoCosto {
  const e = normalizar(etiqueta)
  if (e.includes('fabricac')) return 'mo_fab'
  if (e.includes('montaje')) return 'mo_montaje'
  if (e.includes('material') || e.includes('artefacto') || e.includes('provision')) return 'material'
  if (e === 'mo' || e.startsWith('mo ') || e.includes('mano de obra') || e.includes('colocacion')) return 'mo'
  // Sin etiqueta clara: depende de la naturaleza del rubro.
  return esRubroMo ? 'mo' : 'material'
}

export function parsearBase0(filas: Array<Array<string | number | null>>): PreviewBase0 {
  const rubros: RubroImportado[] = []
  const advertencias: string[] = []
  let actual: RubroImportado | null = null

  const cerrar = () => {
    if (!actual) return
    if (actual.totalUsdM2 > 0) rubros.push(actual)
    actual = null
  }

  for (const celdas of filas) {
    const nombreRubro = esFilaRubro(celdas)
    if (nombreRubro) {
      cerrar()
      const clave = SINONIMOS[normalizar(nombreRubro)] ?? normalizar(nombreRubro)
      const mapeo = resolverMapeoRubro(clave)
      actual = {
        nombreOriginal: nombreRubro,
        rubroCatalogo: mapeo ? clave : null,
        codigoFlexxus: mapeo ? mapeo.codigoRubro : null,
        materialUsdM2: 0,
        moFabUsdM2: 0,
        moMontajeUsdM2: 0,
        totalUsdM2: 0,
        subrubros: [],
      }
      continue
    }

    if (!actual) continue
    const valor = primerNumero(celdas)
    if (valor === null || valor <= 0) continue
    const etiqueta = etiquetaDe(celdas)
    if (!etiqueta) continue

    const esRubroMo = actual.rubroCatalogo ? RUBROS_MO.has(actual.rubroCatalogo) : false
    const tipo = clasificar(etiqueta, esRubroMo)
    actual.subrubros.push({ nombre: etiqueta, tipo, valorUsdM2: valor })

    if (tipo === 'material') actual.materialUsdM2 += valor
    else if (tipo === 'mo_fab') actual.moFabUsdM2 += valor
    else if (tipo === 'mo_montaje') actual.moMontajeUsdM2 += valor
    else actual.moFabUsdM2 += valor // 'mo' combinada → bucket de fabricación
    actual.totalUsdM2 += valor
  }
  cerrar()

  const sinMapear = rubros.filter((r) => r.codigoFlexxus === null).map((r) => r.nombreOriginal)
  if (rubros.length === 0) {
    advertencias.push('No se detectaron rubros con valores. ¿La planilla tiene la columna de USD/m² completa?')
  }
  for (const nombre of sinMapear) {
    advertencias.push(`Rubro sin código Flexxus: "${nombre}" (se importa pero no se exporta a Flexxus)`)
  }

  return { rubros, sinMapear, advertencias }
}
