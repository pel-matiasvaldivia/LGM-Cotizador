import { createClient } from '@/lib/supabase'

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

export interface EstimacionResult {
  totalCostoUSD: number
  totalVentaUSD: number
  cantidadItems: number
}

// Función pura: calcula ítems sin tocar la DB
export function calcularItems(datos: DatosTecnicos, ratios: any[]): any[] {
  const items = []
  let orden = 1

  for (const ratio of ratios) {
    const subrubro = ratio.subrubros as any
    const rubro = subrubro?.rubros as any

    const incluido = esRubroIncluido(rubro?.nombre, subrubro?.nombre, datos)
    if (!incluido) continue

    const cantidad = calcularCantidad(ratio, datos)
    const costoARS = cantidad * ratio.precio_unitario_ars
    const costoUSD = cantidad * ratio.precio_unitario_usd

    items.push({
      rubro_id: rubro?.id,
      subrubro_id: subrubro?.id,
      descripcion: subrubro?.nombre,
      unidad: ratio.unidad,
      cantidad,
      precio_unitario_ars: ratio.precio_unitario_ars,
      precio_unitario_usd: ratio.precio_unitario_usd,
      costo_total_ars: costoARS,
      costo_total_usd: costoUSD,
      margen: 0.20,
      precio_venta_ars: costoARS * 1.20,
      precio_venta_usd: costoUSD * 1.20,
      incluido: true,
      orden: orden++,
    })
  }

  return items
}

// Calcula y guarda en DB
export async function calcularBase0(proyectoId: string, datos: DatosTecnicos) {
  const supabase = createClient()

  const { data: ratios, error: ratiosError } = await supabase
    .from('ratios_costos')
    .select('*, subrubros(*, rubros(*))')
    .eq('vigente', true)

  if (ratiosError || !ratios) throw new Error('No hay ratios de costo configurados')

  const items = calcularItems(datos, ratios).map(item => ({
    ...item,
    proyecto_id: proyectoId,
  }))

  return items
}

// Estima el total SIN guardar en DB (para precio en vivo del wizard)
export async function estimarCosto(datos: DatosTecnicos): Promise<EstimacionResult> {
  const supabase = createClient()

  const { data: ratios, error } = await supabase
    .from('ratios_costos')
    .select('*, subrubros(*, rubros(*))')
    .eq('vigente', true)

  if (error || !ratios) {
    return { totalCostoUSD: 0, totalVentaUSD: 0, cantidadItems: 0 }
  }

  const items = calcularItems(datos, ratios)

  const totalCostoUSD = items.reduce((sum, i) => sum + (i.costo_total_usd || 0), 0)
  const totalVentaUSD = items.reduce((sum, i) => sum + (i.precio_venta_usd || 0), 0)

  return { totalCostoUSD, totalVentaUSD, cantidadItems: items.length }
}

function calcularCantidad(ratio: any, datos: DatosTecnicos): number {
  const ratioCantidad = Number(ratio.ratio_cantidad || 0)
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

function esRubroIncluido(rubroNombre: string | undefined, subrubroNombre: string | undefined, datos: DatosTecnicos): boolean {
  if (!rubroNombre || !subrubroNombre) return false
  const r = rubroNombre.toLowerCase()
  const s = subrubroNombre.toLowerCase()

  // ESTRUCTURA METALICA: filtro por tipologia activa
  if (r.includes('estructura')) {
    if (!datos.incluye_fabricacion) return false

    if (datos.tipologia) {
      const tipo = datos.tipologia.toLowerCase().replace(/_/g, ' ')
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
      const tc = datos.tipo_cubierta.toLowerCase().replace(/_/g, ' ')
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

  if (r.includes('piso')      && !datos.incluye_piso_industrial)         return false
  if (r.includes('electrica') && !datos.incluye_instalacion_electrica)   return false
  if (r.includes('sanitaria') && !datos.incluye_instalacion_sanitaria)   return false

  return true
}
