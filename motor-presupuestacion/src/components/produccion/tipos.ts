// Tipos del circuito de producción tal como viajan desde la API (snake_case,
// el contrato que usa toda la UI del proyecto).

export type Sector = 'oficina_tecnica' | 'abastecimiento' | 'taller' | 'logistica'

export type Etapa =
  | 'materiales' | 'verificacion' | 'compras' | 'recepcion'
  | 'fabricacion' | 'despacho' | 'obra' | 'cerrada'

export interface MaterialRow {
  id: string
  subconjunto: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad_requerida: number
  /** Existencia que traía la exportación del ERP, si la traía. */
  stock_erp: number | null
  cantidad_disponible: number
  cantidad_recibida: number
  cantidad_pendiente: number
  estado: 'pendiente' | 'disponible' | 'faltante' | 'pedido' | 'recibido'
  origen: string
  nota: string
}

export interface OrdenCompraRow {
  id: string
  numero: string
  estado: 'borrador' | 'pedida' | 'recibida_parcial' | 'recibida' | 'anulada'
  fecha_necesidad: string
  proveedor: string
  referencia_erp: string
  notas: string
  pedida_at: string | null
  cerrada_at: string | null
  created_at: string
  items: Array<{ id: string; material_id: string; cantidad: number; cantidad_recibida: number }>
}

export interface ParteRow {
  id: string
  nombre: string
  cantidad: number
  unidad: string
  estado: 'pendiente' | 'en_proceso' | 'terminada'
  cantidad_despachada: number
  responsable: string
  notas: string
  iniciada_at: string | null
  terminada_at: string | null
}

export interface DespachoRow {
  id: string
  numero: string
  estado: 'preparado' | 'en_transito' | 'entregado' | 'rechazado'
  fecha_salida: string
  transporte: string
  chofer: string
  patente: string
  destino: string
  observaciones: string
  despachado_at: string | null
  recibido_por: string
  recibido_at: string | null
  conformidad: string
  observaciones_obra: string
  items: Array<{
    id: string
    parte_id: string | null
    descripcion: string
    cantidad: number
    unidad: string
    cantidad_recibida: number
    observaciones: string
  }>
}

export interface BitacoraRow {
  id: string
  sector: string
  etapa: string
  accion: string
  detalle: string
  usuario: string
  created_at: string
}

export interface CircuitoRow {
  orden: { id: string; numero: string; etapa: Etapa; fecha_entrega_comprometida: string; prioridad: string; estado: string }
  etapas: Array<{ clave: Etapa; titulo: string; sector: Sector | null }>
  puede: Record<Sector, boolean>
  materiales: MaterialRow[]
  ordenes_compra: OrdenCompraRow[]
  partes: ParteRow[]
  despachos: DespachoRow[]
  bitacora: BitacoraRow[]
}

export const NOMBRE_SECTOR: Record<Sector, string> = {
  oficina_tecnica: 'Oficina técnica',
  abastecimiento: 'Abastecimiento',
  taller: 'Taller',
  logistica: 'Logística y obra',
}

export const input =
  'block w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-brand-ink focus:ring-2 focus:ring-brand focus:border-transparent outline-none'
export const label = 'block text-xs font-semibold text-slate-500 mb-1'

export function cantidad(n: number, unidad = ''): string {
  const texto = Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return unidad ? `${texto} ${unidad}` : texto
}

export function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function fecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

/** Agrupa los materiales por subconjunto conservando el orden de llegada. */
export function porSubconjunto(materiales: MaterialRow[]): Array<[string, MaterialRow[]]> {
  const grupos = new Map<string, MaterialRow[]>()
  for (const m of materiales) {
    const clave = m.subconjunto || 'Sin agrupar'
    const lista = grupos.get(clave)
    if (lista) lista.push(m)
    else grupos.set(clave, [m])
  }
  return [...grupos.entries()]
}
