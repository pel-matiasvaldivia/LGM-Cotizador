import { describe, it, expect } from 'vitest'
import {
  haversineKm,
  parseNominatim,
  parseOsrm,
  parseGoogleMatrix,
  FACTOR_RUTA,
} from './geodistance'

describe('haversineKm', () => {
  it('distancia Mendoza → Buenos Aires ≈ 985 km (línea recta)', () => {
    const mendoza = { lat: -32.8895, lon: -68.8458 }
    const bsas = { lat: -34.6037, lon: -58.3816 }
    const km = haversineKm(mendoza, bsas)
    expect(km).toBeGreaterThan(970)
    expect(km).toBeLessThan(1000)
  })

  it('distancia de un punto a sí mismo es 0', () => {
    const p = { lat: -34.6, lon: -58.4 }
    expect(haversineKm(p, p)).toBeCloseTo(0, 6)
  })
})

describe('parseNominatim', () => {
  it('extrae lat/lon del primer resultado', () => {
    const data = [{ lat: '-32.8895', lon: '-68.8458', display_name: 'Mendoza' }]
    expect(parseNominatim(data)).toEqual({ lat: -32.8895, lon: -68.8458 })
  })

  it('devuelve null si no hay resultados', () => {
    expect(parseNominatim([])).toBeNull()
    expect(parseNominatim(null)).toBeNull()
    expect(parseNominatim([{ lat: 'x', lon: 'y' }])).toBeNull()
  })
})

describe('parseOsrm', () => {
  it('convierte metros a km', () => {
    expect(parseOsrm({ routes: [{ distance: 12500 }] })).toBe(12.5)
  })

  it('devuelve null si no hay ruta', () => {
    expect(parseOsrm({ routes: [] })).toBeNull()
    expect(parseOsrm({})).toBeNull()
  })
})

describe('parseGoogleMatrix', () => {
  it('extrae distancia en km cuando el elemento está OK', () => {
    const data = { rows: [{ elements: [{ status: 'OK', distance: { value: 98000 } }] }] }
    expect(parseGoogleMatrix(data)).toBe(98)
  })

  it('devuelve null si el elemento no está OK', () => {
    const data = { rows: [{ elements: [{ status: 'ZERO_RESULTS' }] }] }
    expect(parseGoogleMatrix(data)).toBeNull()
  })
})

describe('FACTOR_RUTA', () => {
  it('las rutas por camino son más largas que la línea recta', () => {
    expect(FACTOR_RUTA).toBeGreaterThan(1)
  })
})
