import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { ratiosCostos, type RatioCosto, type Rubro, type Subrubro, type NuevoPresupuestoItem } from '@/db/schema'
import { getParametros, resolverCoefZona, type Parametros } from '@/lib/parametros'

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
  distancia_obra_km?: number
  ubicacion?: string
  [key: string]: unknown
}

export type RatioConCatalogo = RatioCosto & { subrubro: Subrubro & { rubro: Rubro } }

export type ItemCalculado = Omit<NuevoPresupuestoItem, 'proyectoId' | 'id'>

// Cascada de costeo: de costo directo a precio final (replica la planilla Base 0)
export interface ResumenCosteo {
  costoMaterialUsd: number
  costoMoUsd: number
  costoDirectoUsd: number       // (material·(1+desperdicio) + mo) · (1+coefZona)
  costosIndirectosUsd: number
  subtotalUsd: number
  beneficioUsd: number
  totalSinIvaUsd: number
  ivaUsd: number
  totalConIvaUsd: number
  costoM2Usd: number            // subtotal / superficie
  precioM2Usd: number           // total s/IVA / superficie
  coefZona: number
  parametros: Parametros
}

export interface EstimacionResult {
  totalCostoUSD: number
  totalVentaUSD: number
  cantidadItems: number
  resumen: ResumenCosteo
}

// Función pura: calcula los ítems (costos desglosados material/MO) sin tocar la DB.
export function calcularItems(
  datos: DatosTecnicos,
  ratios: RatioConCatalogo[],
  params: Parametros,
): ItemCalculado[] {
  const items: ItemCalculado[] = []
  let orden = 1

  for (const ratio of ratios) {
    const subrubro = ratio.subrubro
    const rubro = subrubro?.rubro
    if (!esRubroIncluido(rubro?.nombre, subrubro?.nombre, datos)) continue

    const cantidad = calcularCantidad(ratio, datos)
    const { material, mo, moFab, moMontaje } = preciosUnitarios(ratio)

    // Montaje: única opción de alcance. Si no se incluye, se descarta la porción
    // de MO de Montaje del ratio (cuando viene desglosada, p. ej. del Base 0).
    const incluyeMontaje = datos.incluye_montaje !== false
    const moMontajeEfectivo = incluyeMontaje ? moMontaje : 0
    const tieneSplit = moFab > 0 || moMontaje > 0
    const moEfectivo = tieneSplit ? moFab + moMontajeEfectivo : mo

    const costoMaterialUsd = cantidad * material
    const costoMoUsd = cantidad * moEfectivo
    const costoUSD = costoMaterialUsd + costoMoUsd

    items.push({
      rubroId: rubro?.id ?? null,
      subrubroId: subrubro?.id ?? null,
      descripcion: subrubro?.nombre ?? '',
      unidad: ratio.unidad,
      cantidad,
      precioUnitarioArs: (material + moEfectivo) * params.tipoCambio,
      precioUnitarioUsd: material + moEfectivo,
      costoMaterialUsd,
      costoMoUsd,
      costoMoFabUsd: cantidad * moFab,
      costoMoMontajeUsd: cantidad * moMontajeEfectivo,
      incidencia: 0, // se completa abajo, con el total conocido
      costoTotalArs: costoUSD * params.tipoCambio,
      costoTotalUsd: costoUSD,
      margen: 0,
      precioVentaArs: costoUSD * params.tipoCambio,
      precioVentaUsd: costoUSD,
      incluido: true,
      orden: orden++,
    })
  }

  // Logística por distancia a obra (fletes). Solo si se cargó la distancia.
  items.push(...calcularLogistica(datos, params, orden))

  // Incidencia = costo del ítem / costo directo total
  const totalDirecto = items.reduce((s, i) => s + (i.costoTotalUsd || 0), 0)
  if (totalDirecto > 0) {
    for (const it of items) it.incidencia = (it.costoTotalUsd || 0) / totalDirecto
  }

  return items
}

// Ítems de logística (camión + camioneta), generados a partir de la distancia.
function calcularLogistica(datos: DatosTecnicos, params: Parametros, ordenInicial: number): ItemCalculado[] {
  const km = Number(datos.distancia_obra_km || 0)
  if (!(km > 0)) return []

  const salidas: Array<[string, number, number]> = [
    ['Flete camión', params.viajesCamion, params.fleteCamionUsdKm],
    ['Flete camioneta', params.viajesCamioneta, params.fleteCamionetaUsdKm],
  ]
  const items: ItemCalculado[] = []
  let orden = ordenInicial
  for (const [nombre, viajes, tarifa] of salidas) {
    if (!(viajes > 0) || !(tarifa > 0)) continue
    const cantidad = viajes * km // km totales (viajes × distancia)
    const costo = cantidad * tarifa
    items.push({
      rubroId: null,
      subrubroId: null,
      descripcion: nombre,
      unidad: 'km',
      cantidad,
      precioUnitarioArs: tarifa * params.tipoCambio,
      precioUnitarioUsd: tarifa,
      costoMaterialUsd: costo, // el flete se cuenta como costo directo (no MO de obra)
      costoMoUsd: 0,
      costoMoFabUsd: 0,
      costoMoMontajeUsd: 0,
      incidencia: 0,
      costoTotalArs: costo * params.tipoCambio,
      costoTotalUsd: costo,
      margen: 0,
      precioVentaArs: costo * params.tipoCambio,
      precioVentaUsd: costo,
      incluido: true,
      orden: orden++,
    })
  }
  return items
}

// Cascada: de la suma de ítems al precio final, aplicando los parámetros.
export function calcularResumen(
  items: Pick<ItemCalculado, 'costoMaterialUsd' | 'costoMoUsd'>[],
  params: Parametros,
  superficieM2: number,
  ubicacion?: string | null,
): ResumenCosteo {
  const coefZona = resolverCoefZona(ubicacion, params)
  const costoMaterialUsd = items.reduce((s, i) => s + (i.costoMaterialUsd || 0), 0)
  const costoMoUsd = items.reduce((s, i) => s + (i.costoMoUsd || 0), 0)

  const materialAjustado = costoMaterialUsd * (1 + params.desperdicios)
  const costoDirectoUsd = (materialAjustado + costoMoUsd) * (1 + coefZona)
  const costosIndirectosUsd = costoDirectoUsd * params.costosIndirectos
  const subtotalUsd = costoDirectoUsd + costosIndirectosUsd
  const beneficioUsd = subtotalUsd * params.beneficio
  const totalSinIvaUsd = subtotalUsd + beneficioUsd
  const ivaUsd = totalSinIvaUsd * params.iva
  const totalConIvaUsd = totalSinIvaUsd + ivaUsd

  const sup = superficieM2 > 0 ? superficieM2 : 0
  return {
    costoMaterialUsd,
    costoMoUsd,
    costoDirectoUsd,
    costosIndirectosUsd,
    subtotalUsd,
    beneficioUsd,
    totalSinIvaUsd,
    ivaUsd,
    totalConIvaUsd,
    costoM2Usd: sup ? subtotalUsd / sup : 0,
    precioM2Usd: sup ? totalSinIvaUsd / sup : 0,
    coefZona,
    parametros: params,
  }
}

export async function fetchRatiosVigentes(): Promise<RatioConCatalogo[]> {
  const ratios = await db.query.ratiosCostos.findMany({
    where: eq(ratiosCostos.vigente, true),
    with: { subrubro: { with: { rubro: true } } },
  })
  return ratios as RatioConCatalogo[]
}

// Calcula los ítems del presupuesto Base 0 para un proyecto (sin persistir).
export async function calcularBase0(proyectoId: string, datos: DatosTecnicos): Promise<NuevoPresupuestoItem[]> {
  const [ratios, params] = await Promise.all([fetchRatiosVigentes(), getParametros()])
  if (ratios.length === 0) throw new Error('No hay ratios de costo configurados')

  return calcularItems(datos, ratios, params).map((item) => ({ ...item, proyectoId }))
}

// Estima el total SIN guardar (para el precio en vivo del wizard) + cascada.
export async function estimarCosto(datos: DatosTecnicos): Promise<EstimacionResult> {
  const [ratios, params] = await Promise.all([fetchRatiosVigentes(), getParametros()])
  const items = calcularItems(datos, ratios, params)
  const resumen = calcularResumen(items, params, Number(datos.superficie_m2 || 0), datos.ubicacion)

  return {
    totalCostoUSD: resumen.costoDirectoUsd,
    totalVentaUSD: resumen.totalSinIvaUsd,
    cantidadItems: items.length,
    resumen,
  }
}

// Costo unitario material/MO del ratio, con fallback a versiones previas
// (donde solo existía precio_unitario_usd → se toma como material).
// moFab/moMontaje traen el desglose real (Base 0); si el ratio no lo tiene,
// quedan en 0 y la MO combinada (mo) sigue siendo la fuente del costeo.
function preciosUnitarios(
  ratio: RatioConCatalogo,
): { material: number; mo: number; moFab: number; moMontaje: number } {
  const material = Number(ratio.precioMaterialUsd || 0)
  const mo = Number(ratio.precioMoUsd || 0)
  const moFab = Number(ratio.precioMoFabUsd || 0)
  const moMontaje = Number(ratio.precioMoMontajeUsd || 0)
  if (material === 0 && mo === 0) {
    return { material: Number(ratio.precioUnitarioUsd || 0), mo: 0, moFab: 0, moMontaje: 0 }
  }
  return { material, mo, moFab, moMontaje }
}

function calcularCantidad(ratio: RatioConCatalogo, datos: DatosTecnicos): number {
  const ratioCantidad = Number(ratio.ratioCantidad || 0)
  const superficie = Number(datos.superficie_m2 || 0)

  switch (ratio.unidad) {
    case 'kg/m2':
    case 'kg':
    case 'm2':
    case 'm3':
    case 'gl':
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

// El catálogo (Base 0 importado) define QUÉ se cotiza: todos sus rubros entran
// al presupuesto. La única opción de alcance es el montaje. Las tipologías y
// tipos de cubierta sólo eligen entre variantes cuando el catálogo las ofrece
// (p. ej. el seed con Estructura Alveolar/Alma Llena/Reticulada); un ratio
// genérico —sin variante en el nombre— se incluye siempre.
export function esRubroIncluido(
  rubroNombre: string | undefined,
  subrubroNombre: string | undefined,
  datos: DatosTecnicos,
): boolean {
  if (!rubroNombre || !subrubroNombre) return false
  const r = normalizar(rubroNombre)
  const s = normalizar(subrubroNombre)

  // Montaje: única opción de alcance. Excluye el rubro "Montaje" si el cliente
  // no lo incluye (la porción de MO Montaje desglosada se maneja en calcularItems).
  if (r.includes('montaje') && datos.incluye_montaje === false) return false

  // ESTRUCTURA: si el catálogo trae variantes por tipología, elegir la activa.
  if (r.includes('estructura') && datos.tipologia) {
    const nombraTipologia =
      s.includes('alveolar') || s.includes('alma llena') || s.includes('reticulada')
    if (nombraTipologia) {
      const tipo = normalizar(datos.tipologia).replace(/_/g, ' ')
      if (tipo === 'alveolar' && !s.includes('alveolar')) return false
      if (tipo.includes('alma') && !s.includes('alma llena')) return false
      if (tipo.includes('reticulad') && !s.includes('reticulada')) return false
    }
  }

  // CUBIERTA: elegir la variante según el tipo de cubierta, si hay variantes.
  if (r.includes('cubierta') && datos.tipo_cubierta) {
    const tc = normalizar(datos.tipo_cubierta).replace(/_/g, ' ')
    const isPanel = tc.includes('panel') || tc.includes('sandwich')
    if (isPanel && s.includes('chapa trapezoidal')) return false
    if (!isPanel && s.includes('panel sandwich')) return false
  }

  return true
}
