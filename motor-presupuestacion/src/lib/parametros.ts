import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { configuracion } from '@/db/schema'

// Parámetros globales del costeo (guardados en la tabla `configuracion`).
// La cascada de precio los usa para pasar de costo directo a precio final,
// replicando la planilla Base 0 real.
export interface Parametros {
  tipoCambio: number // ARS por USD
  iva: number // 0.21
  costosIndirectos: number // 0.05 (dirección + administración + otros)
  beneficio: number // 0.1251
  desperdicios: number // 0.00 — se aplica sobre materiales
  coeficienteZona: number // 0.00 — ajuste por zona por defecto
  fleteCamionUsdKm: number // tarifa USD por km (camión)
  fleteCamionetaUsdKm: number // tarifa USD por km (camioneta)
  viajesCamion: number // viajes de camión considerados
  viajesCamioneta: number // viajes de camioneta considerados
  ubicacionBase: string // dirección del taller/base (origen de los fletes)
  zonas: Record<string, number> // provincia/keyword -> coeficiente
}

export const PARAMETROS_DEFAULT: Parametros = {
  tipoCambio: 1050,
  iva: 0.21,
  costosIndirectos: 0.05,
  beneficio: 0.1251,
  desperdicios: 0,
  coeficienteZona: 0,
  fleteCamionUsdKm: 1.76,
  fleteCamionetaUsdKm: 1.76,
  viajesCamion: 0,
  viajesCamioneta: 0,
  ubicacionBase: '',
  zonas: {},
}

// Mapeo clave de configuración -> campo de Parametros
const CLAVES: Record<string, keyof Parametros> = {
  tipo_cambio_usd: 'tipoCambio',
  iva: 'iva',
  costos_indirectos: 'costosIndirectos',
  beneficio: 'beneficio',
  desperdicios: 'desperdicios',
  coeficiente_zona: 'coeficienteZona',
  flete_camion_usd_km: 'fleteCamionUsdKm',
  flete_camioneta_usd_km: 'fleteCamionetaUsdKm',
  viajes_camion: 'viajesCamion',
  viajes_camioneta: 'viajesCamioneta',
  ubicacion_base: 'ubicacionBase',
  zonas: 'zonas',
}

export async function getParametros(): Promise<Parametros> {
  const filas = await db.query.configuracion.findMany({
    where: inArray(configuracion.clave, Object.keys(CLAVES)),
  })
  const p: Parametros = { ...PARAMETROS_DEFAULT }
  for (const fila of filas) {
    const campo = CLAVES[fila.clave]
    if (!campo) continue
    if (campo === 'zonas') {
      if (fila.valor && typeof fila.valor === 'object') p.zonas = fila.valor as Record<string, number>
    } else if (campo === 'ubicacionBase') {
      if (typeof fila.valor === 'string') p.ubicacionBase = fila.valor
    } else if (typeof fila.valor === 'number' && Number.isFinite(fila.valor)) {
      ;(p[campo] as number) = fila.valor
    }
  }
  return p
}

// Normaliza a minúsculas sin tildes (para matchear "Mendoza" con "mendoza").
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Resuelve el coeficiente de zona a partir de la ubicación del proyecto.
// Busca la primera provincia/keyword de `zonas` contenida en la ubicación;
// si no hay match, usa el coeficiente por defecto.
export function resolverCoefZona(ubicacion: string | null | undefined, params: Parametros): number {
  if (ubicacion) {
    const u = normalizar(ubicacion)
    for (const [clave, coef] of Object.entries(params.zonas)) {
      if (u.includes(normalizar(clave))) return coef
    }
  }
  return params.coeficienteZona
}
