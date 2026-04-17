import { createClient } from '@/lib/supabase'

export interface DatosTecnicos {
  superficie_m2: number
  altura_libre_m: number
  tipologia: string
  incluye_fabricacion: boolean
  incluye_montaje: boolean
  incluye_cubierta: boolean
  incluye_cerramiento_lateral: boolean
  incluye_portones: boolean
  incluye_piso_industrial: boolean
  incluye_instalacion_electrica: boolean
  incluye_instalacion_sanitaria: boolean
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
    case 'm2':
      return ratioCantidad * superficie
    case 'uni':
      return ratioCantidad
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

  if (r.includes('estructura')) {
    if (!datos.incluye_fabricacion) return false
    
    // Filtro mutualmente exclusivo por tipologia
    if (datos.tipologia) {
      const tipo = datos.tipologia.toLowerCase()
      if (tipo === 'alveolar' && !s.includes('alveolar')) return false
      if (tipo.includes('alma') && !s.includes('alma llena')) return false
      if (tipo.includes('reticulad') && !s.includes('reticulada')) return false
    }
  }

  if (r.includes('cubierta') && !datos.incluye_cubierta) return false
  if (r.includes('cerramiento lateral') && !datos.incluye_cerramiento_lateral) return false
  if (r.includes('porton') && !datos.incluye_portones) return false
  if (r.includes('piso') && !datos.incluye_piso_industrial) return false
  if (r.includes('electrica') && !datos.incluye_instalacion_electrica) return false
  if (r.includes('sanitaria') && !datos.incluye_instalacion_sanitaria) return false
  return true
}
