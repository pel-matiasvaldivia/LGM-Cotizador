// Cálculo de distancia por ruta entre dos direcciones (para la logística/flete).
//
// Estrategia (degradación elegante):
//  1) Si hay GEOCODING_API_KEY (Google), se usa Distance Matrix: acepta
//     direcciones en texto y devuelve la distancia real por camino.
//  2) Si no, se geocodifica cada dirección con Nominatim (OpenStreetMap) y se
//     traza la ruta con OSRM.
//  3) Si OSRM falla, se estima con distancia geodésica (Haversine) × factor de
//     ruta, para no dejar al usuario sin un número aproximado.
//
// En cualquier caso, si no hay red de salida disponible, devuelve `null` y el
// usuario carga la distancia a mano.

export interface Coord {
  lat: number
  lon: number
}

export interface DistanciaResult {
  km: number
  fuente: 'google' | 'osrm' | 'estimada'
  origen: string
  destino: string
}

// Las rutas por camino son más largas que la línea recta. Factor típico ~1.3.
export const FACTOR_RUTA = 1.3

const GEOCODE_TIMEOUT_MS = 12000

// Distancia geodésica (círculo máximo) en kilómetros.
export function haversineKm(a: Coord, b: Coord): number {
  const R = 6371 // radio terrestre medio (km)
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const lat1 = rad(a.lat)
  const lat2 = rad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Parseo de la respuesta de Nominatim (array de resultados con lat/lon en texto).
export function parseNominatim(data: unknown): Coord | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const primero = data[0] as { lat?: string; lon?: string }
  const lat = Number(primero.lat)
  const lon = Number(primero.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

// Parseo de la respuesta de OSRM: routes[0].distance viene en metros.
export function parseOsrm(data: unknown): number | null {
  const d = data as { routes?: Array<{ distance?: number }> }
  const metros = d?.routes?.[0]?.distance
  if (typeof metros !== 'number' || !Number.isFinite(metros)) return null
  return metros / 1000
}

// Parseo de Google Distance Matrix: rows[0].elements[0].distance.value en metros.
export function parseGoogleMatrix(data: unknown): number | null {
  const d = data as {
    rows?: Array<{ elements?: Array<{ status?: string; distance?: { value?: number } }> }>
  }
  const el = d?.rows?.[0]?.elements?.[0]
  if (!el || el.status !== 'OK') return null
  const metros = el.distance?.value
  if (typeof metros !== 'number' || !Number.isFinite(metros)) return null
  return metros / 1000
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), GEOCODE_TIMEOUT_MS)
    const res = await fetch(url, { headers, signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function geocodar(direccion: string): Promise<Coord | null> {
  const q = encodeURIComponent(direccion)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`
  const data = await fetchJson(url, { 'User-Agent': 'LGM-Cotizador/1.0 (presupuestos)' })
  return parseNominatim(data)
}

async function distanciaGoogle(origen: string, destino: string, key: string): Promise<number | null> {
  const o = encodeURIComponent(origen)
  const d = encodeURIComponent(destino)
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${o}&destinations=${d}&mode=driving&language=es&key=${key}`
  return parseGoogleMatrix(await fetchJson(url))
}

async function rutaOsrm(a: Coord, b: Coord): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`
  return parseOsrm(await fetchJson(url))
}

// Devuelve la distancia por ruta (km) entre dos direcciones en texto, o null.
export async function calcularDistanciaRuta(
  origen: string,
  destino: string,
): Promise<DistanciaResult | null> {
  const org = (origen || '').trim()
  const dst = (destino || '').trim()
  if (!org || !dst) return null

  // 1) Google Distance Matrix (si hay API key)
  const key = process.env.GEOCODING_API_KEY
  if (key) {
    const km = await distanciaGoogle(org, dst, key)
    if (km != null) return { km, fuente: 'google', origen: org, destino: dst }
  }

  // 2/3) Nominatim + OSRM, con fallback a Haversine × factor
  const [a, b] = await Promise.all([geocodar(org), geocodar(dst)])
  if (!a || !b) return null

  const kmRuta = await rutaOsrm(a, b)
  if (kmRuta != null) return { km: kmRuta, fuente: 'osrm', origen: org, destino: dst }

  return { km: haversineKm(a, b) * FACTOR_RUTA, fuente: 'estimada', origen: org, destino: dst }
}
