import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { ratiosCostos, type RatioCosto, type Rubro, type Subrubro, type NuevoPresupuestoItem } from '@/db/schema'

export interface DatosTecnicos {
  superficie_m2: number
  altura_libre_m?: number
  tipologia: string          // ALVEOLAR | ALMA_LLENA | RETICULADA
  tipo_cubierta?: string     // CHAPA_TRAPEZOIDAL | PANEL_SANDWICH
  incluye_fabricacion: boolean
  incluye_montaje: boolean
  incluye_cubierta: boolean
  incluye_cerramiento_lateral: boolean
  incluye_portones: boolean
  incluye_piso_industrial: boolean
  incluye_instalacion_electrica: boolean
  incluye_instalacion_sanitaria: boolean
  cantidad_portones?: number
  [key: string]: unknown
}

export type RatioConCatalogo = RatioCosto & { subrubro: Subrubro & { rubro: Rubro } }

export type ItemCalculado = Omit<NuevoPresupuestoItem, 'proyectoId' | 'id'>

export interface EstimacionResult {
  totalCostoUSD: number
  totalVentaUSD: number
  cantidadItems: number
}

const MARGEN_DEFAULT = 0.2

// Función pura: calcula ítems sin tocar la DB
export function calcularItems(
  datos: DatosTecnicos,
  ratios: RatioConCatalogo[],
  margen: number = MARGEN_DEFAULT,
): ItemCalculado[] {
  const items: ItemCalculado[] = []
  let orden = 1

  for (const ratio of ratios) {
    const subrubro = ratio.subrubro
    const rubro = subrubro?.rubro

    const incluido = esRubroIncluido(rubro?.nombre, subrubro?.nombre, datos)
    if (!incluido) continue

    const cantidad = calcularCantidad(ratio, datos)
    const costoARS = cantidad * ratio.precioUnitarioArs
    const costoUSD = cantidad * ratio.precioUnitarioUsd

    items.push({
      rubroId: rubro?.id ?? null,
      subrubroId: subrubro?.id ?? null,
      descripcion: subrubro?.nombre ?? '',
      unidad: ratio.unidad,
      cantidad,
      precioUnitarioArs: ratio.precioUnitarioArs,
      precioUnitarioUsd: ratio.precioUnitarioUsd,
      costoTotalArs: costoARS,
      costoTotalUsd: costoUSD,
      margen,
      precioVentaArs: costoARS * (1 + margen),
      precioVentaUsd: costoUSD * (1 + margen),
      incluido: true,
      orden: orden++,
    })
  }

  return items
}

export async function fetchRatiosVigentes(): Promise<RatioConCatalogo[]> {
  const ratios = await db.query.ratiosCostos.findMany({
    where: eq(ratiosCostos.vigente, true),
    with: { subrubro: { with: { rubro: true } } },
  })
  return ratios as RatioConCatalogo[]
}

// Calcula los ítems del presupuesto Base 0 para un proyecto (sin persistir)
export async function calcularBase0(proyectoId: string, datos: DatosTecnicos): Promise<NuevoPresupuestoItem[]> {
  const ratios = await fetchRatiosVigentes()
  if (ratios.length === 0) throw new Error('No hay ratios de costo configurados')

  return calcularItems(datos, ratios).map((item) => ({ ...item, proyectoId }))
}

// Estima el total SIN guardar en DB (para precio en vivo del wizard)
export async function estimarCosto(datos: DatosTecnicos): Promise<EstimacionResult> {
  const ratios = await fetchRatiosVigentes()
  const items = calcularItems(datos, ratios)

  const totalCostoUSD = items.reduce((sum, i) => sum + (i.costoTotalUsd || 0), 0)
  const totalVentaUSD = items.reduce((sum, i) => sum + (i.precioVentaUsd || 0), 0)

  return { totalCostoUSD, totalVentaUSD, cantidadItems: items.length }
}

function calcularCantidad(ratio: RatioConCatalogo, datos: DatosTecnicos): number {
  const ratioCantidad = Number(ratio.ratioCantidad || 0)
  const superficie = Number(datos.superficie_m2 || 0)

  switch (ratio.unidad) {
    case 'kg/m2':
    case 'kg':
    case 'm2':
    case 'm3':
      return ratioCantidad * superficie
    case 'uni':
      return ratioCantidad * (Number(datos.cantidad_portones) || 1)
    default:
      return ratioCantidad
  }
}

// Minúsculas y sin tildes, para que "Instalación Eléctrica" matchee 'electrica'
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function esRubroIncluido(
  rubroNombre: string | undefined,
  subrubroNombre: string | undefined,
  datos: DatosTecnicos,
): boolean {
  if (!rubroNombre || !subrubroNombre) return false
  const r = normalizar(rubroNombre)
  const s = normalizar(subrubroNombre)

  // ESTRUCTURA METALICA: filtro por tipologia activa
  if (r.includes('estructura')) {
    if (!datos.incluye_fabricacion) return false

    if (datos.tipologia) {
      const tipo = normalizar(datos.tipologia).replace(/_/g, ' ')
      const isAlveolar   = tipo === 'alveolar'
      const isAlmaLlena  = tipo.includes('alma') || tipo === 'alma_llena'
      const isReticulada = tipo.includes('reticulad')

      if (isAlveolar   && !s.includes('alveolar'))   return false
      if (isAlmaLlena  && !s.includes('alma llena'))  return false
      if (isReticulada && !s.includes('reticulada'))  return false

      if (!isAlveolar && !isAlmaLlena && !isReticulada) {
        if (s.includes('alveolar') || s.includes('alma llena') || s.includes('reticulada')) return false
      }
    }
  }

  // CUBIERTA
  if (r.includes('cerramiento cubierta') || r.includes('cubierta')) {
    if (!datos.incluye_cubierta) return false
    if (datos.tipo_cubierta) {
      const tc = normalizar(datos.tipo_cubierta).replace(/_/g, ' ')
      const isChapa = tc.includes('chapa') || tc.includes('trapezoidal')
      const isPanel = tc.includes('panel') || tc.includes('sandwich')
      if (isChapa && s.includes('panel sandwich'))    return false
      if (isPanel && s.includes('chapa trapezoidal')) return false
    } else {
      if (s.includes('panel sandwich')) return false
    }
  }

  if (r.includes('cerramiento lateral') && !datos.incluye_cerramiento_lateral) return false

  if (r.includes('porton') || r.includes('portones')) {
    if (!datos.incluye_portones) return false
  }

  if (r.includes('montaje')   && !datos.incluye_montaje)                 return false
  if (r.includes('piso')      && !datos.incluye_piso_industrial)         return false
  if (r.includes('electrica') && !datos.incluye_instalacion_electrica)   return false
  if (r.includes('sanitaria') && !datos.incluye_instalacion_sanitaria)   return false

  return true
}
