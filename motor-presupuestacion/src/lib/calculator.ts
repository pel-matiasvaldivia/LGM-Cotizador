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

export async function calcularBase0(proyectoId: string, datos: DatosTecnicos) {
  const supabase = createClient()

  // Obtener ratios de costo vigentes
  const { data: ratios, error: ratiosError } = await supabase
    .from('ratios_costos')
    .select('*, subrubros(*, rubros(*))')
    .eq('vigente', true)

  if (ratiosError || !ratios) throw new Error('No hay ratios de costo configurados')

  const items = []

  let orden = 1
  for (const ratio of ratios) {
    const subrubro = ratio.subrubros as any
    const rubro = subrubro?.rubros as any

    // Verificar si el rubro/subrubro está incluido en el alcance
    const incluido = esRubroIncluido(rubro?.nombre, subrubro?.nombre, datos)
    if (!incluido) continue

    // Calcular cantidad según unidad y ratio
    const cantidad = calcularCantidad(ratio, datos)
    const costoARS = cantidad * ratio.precio_unitario_ars
    const costoUSD = cantidad * ratio.precio_unitario_usd

    items.push({
      proyecto_id: proyectoId,
      rubro_id: rubro?.id,
      subrubro_id: subrubro?.id,
      descripcion: subrubro?.nombre,
      unidad: ratio.unidad,
      cantidad,
      precio_unitario_ars: ratio.precio_unitario_ars,
      precio_unitario_usd: ratio.precio_unitario_usd,
      costo_total_ars: costoARS,
      costo_total_usd: costoUSD,
      margen: 0.20, // 20% default, editable
      precio_venta_ars: costoARS * 1.20,
      precio_venta_usd: costoUSD * 1.20,
      incluido: true,
      orden: orden++
    })
  }

  return items
}

function calcularCantidad(ratio: any, datos: DatosTecnicos): number {
  const ratioCantidad = Number(ratio.ratio_cantidad || 0)
  const superficie = Number(datos.superficie_m2 || 0)

  switch (ratio.unidad) {
    case 'kg/m2':
      return ratioCantidad * superficie
    case 'kg':
      // kg indicates a ratio per m2, multiply by surface
      return ratioCantidad * superficie
    case 'm2':
      return ratioCantidad * superficie
    case 'uni':
      // For portones use cantidad_portones, default to 1
      return ratioCantidad * (Number(datos.cantidad_portones) || 1)
    case 'm3':
      return ratioCantidad * superficie
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
      const isAlveolar    = tipo === 'alveolar'
      const isAlmaLlena   = tipo.includes('alma') || tipo === 'alma_llena'
      const isReticulada  = tipo.includes('reticulad')

      if (isAlveolar   && !s.includes('alveolar'))   return false
      if (isAlmaLlena  && !s.includes('alma llena'))  return false
      if (isReticulada && !s.includes('reticulada'))  return false

      // Si no coincide con ninguna tipología conocida, excluir tipologías específicas
      if (!isAlveolar && !isAlmaLlena && !isReticulada) {
        if (s.includes('alveolar') || s.includes('alma llena') || s.includes('reticulada')) return false
      }
    }
  }

  // CUBIERTA: filtro por tipo_cubierta (chapa vs panel sandwich)
  if (r.includes('cerramiento cubierta') || r.includes('cubierta')) {
    if (!datos.incluye_cubierta) return false
    if (datos.tipo_cubierta) {
      const tc = datos.tipo_cubierta.toLowerCase().replace(/_/g, ' ')
      const isChapa  = tc.includes('chapa') || tc.includes('trapezoidal')
      const isPanel  = tc.includes('panel') || tc.includes('sandwich')
      if (isChapa  && s.includes('panel sandwich'))    return false
      if (isPanel  && s.includes('chapa trapezoidal')) return false
    } else {
      // Default: chapa trapezoidal, excluir panel sandwich
      if (s.includes('panel sandwich')) return false
    }
  }

  // CERRAMIENTO LATERAL
  if (r.includes('cerramiento lateral') && !datos.incluye_cerramiento_lateral) return false

  // PORTONES
  if (r.includes('porton') || r.includes('portones')) {
    if (!datos.incluye_portones) return false
  }

  if (r.includes('piso')     && !datos.incluye_piso_industrial)          return false
  if (r.includes('electrica') && !datos.incluye_instalacion_electrica)   return false
  if (r.includes('sanitaria') && !datos.incluye_instalacion_sanitaria)   return false
  return true
}
