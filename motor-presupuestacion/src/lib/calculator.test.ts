import { describe, expect, it } from 'vitest'
import { calcularItems, esRubroIncluido, type DatosTecnicos, type RatioConCatalogo } from './calculator'

function ratio(rubroNombre: string, subrubroNombre: string, unidad: string, ratioCantidad: number, usd: number): RatioConCatalogo {
  return {
    id: `ratio-${subrubroNombre}`,
    subrubroId: `sub-${subrubroNombre}`,
    unidad,
    ratioCantidad,
    precioUnitarioArs: usd * 1000,
    precioUnitarioUsd: usd,
    vigente: true,
    fechaActualizacion: new Date(),
    subrubro: {
      id: `sub-${subrubroNombre}`,
      rubroId: `rubro-${rubroNombre}`,
      nombre: subrubroNombre,
      codigoFlexxus: 0,
      rubro: { id: `rubro-${rubroNombre}`, nombre: rubroNombre, codigoFlexxus: 0, orden: 0 },
    },
  }
}

const CATALOGO: RatioConCatalogo[] = [
  ratio('Estructura Metálica', 'Estructura Alveolar', 'kg/m2', 18, 12.6),
  ratio('Estructura Metálica', 'Estructura Alma Llena', 'kg/m2', 28, 12.2),
  ratio('Estructura Metálica', 'Estructura Reticulada', 'kg/m2', 15, 11.8),
  ratio('Cerramiento Cubierta', 'Cubierta Chapa Trapezoidal', 'm2', 1.05, 14.5),
  ratio('Cerramiento Cubierta', 'Cubierta Panel Sandwich', 'm2', 1.05, 32),
  ratio('Cerramiento Lateral', 'Cerramiento Lateral Chapa', 'm2', 0.8, 13),
  ratio('Portones', 'Portón Corredizo Metálico', 'uni', 1, 1850),
  ratio('Piso Industrial', 'Piso Hormigón H-25 c/cuarzo', 'm2', 1, 26),
  ratio('Instalación Eléctrica', 'Instalación Eléctrica Nave', 'm2', 1, 9.5),
  ratio('Instalación Sanitaria', 'Instalación Sanitaria Nave', 'm2', 1, 6),
  ratio('Montaje', 'Montaje en Obra', 'kg/m2', 18, 3.2),
]

function datos(overrides: Partial<DatosTecnicos> = {}): DatosTecnicos {
  return {
    superficie_m2: 1000,
    tipologia: 'ALVEOLAR',
    tipo_cubierta: 'CHAPA_TRAPEZOIDAL',
    incluye_fabricacion: true,
    incluye_montaje: true,
    incluye_cubierta: true,
    incluye_cerramiento_lateral: false,
    incluye_portones: false,
    incluye_piso_industrial: false,
    incluye_instalacion_electrica: false,
    incluye_instalacion_sanitaria: false,
    ...overrides,
  }
}

describe('calcularItems', () => {
  it('selecciona solo la estructura de la tipología elegida', () => {
    const items = calcularItems(datos({ tipologia: 'ALVEOLAR' }), CATALOGO)
    const estructuras = items.filter((i) => i.descripcion?.includes('Estructura'))
    expect(estructuras).toHaveLength(1)
    expect(estructuras[0].descripcion).toBe('Estructura Alveolar')
  })

  it('cambia de estructura con la tipología ALMA_LLENA', () => {
    const items = calcularItems(datos({ tipologia: 'ALMA_LLENA' }), CATALOGO)
    const estructuras = items.filter((i) => i.descripcion?.includes('Estructura'))
    expect(estructuras.map((i) => i.descripcion)).toEqual(['Estructura Alma Llena'])
  })

  it('calcula cantidades por superficie para unidades kg/m2 y m2', () => {
    const items = calcularItems(datos({ superficie_m2: 500 }), CATALOGO)
    const estructura = items.find((i) => i.descripcion === 'Estructura Alveolar')!
    expect(estructura.cantidad).toBe(18 * 500)
    expect(estructura.costoTotalUsd).toBeCloseTo(18 * 500 * 12.6)
  })

  it('aplica el margen sobre el costo', () => {
    const items = calcularItems(datos(), CATALOGO, 0.35)
    for (const item of items) {
      expect(item.margen).toBe(0.35)
      expect(item.precioVentaUsd).toBeCloseTo(item.costoTotalUsd! * 1.35)
    }
  })

  it('excluye cubierta panel sandwich si se eligió chapa', () => {
    const items = calcularItems(datos({ tipo_cubierta: 'CHAPA_TRAPEZOIDAL' }), CATALOGO)
    expect(items.some((i) => i.descripcion?.includes('Panel Sandwich'))).toBe(false)
    expect(items.some((i) => i.descripcion?.includes('Chapa Trapezoidal'))).toBe(true)
  })

  it('multiplica portones por cantidad', () => {
    const items = calcularItems(datos({ incluye_portones: true, cantidad_portones: 3 }), CATALOGO)
    const porton = items.find((i) => i.descripcion?.includes('Portón'))!
    expect(porton.cantidad).toBe(3)
    expect(porton.costoTotalUsd).toBeCloseTo(3 * 1850)
  })

  it('excluye los rubros opcionales apagados', () => {
    const items = calcularItems(datos(), CATALOGO)
    const nombres = items.map((i) => i.descripcion)
    expect(nombres).not.toContain('Cerramiento Lateral Chapa')
    expect(nombres).not.toContain('Piso Hormigón H-25 c/cuarzo')
    expect(nombres).not.toContain('Instalación Eléctrica Nave')
    expect(nombres).not.toContain('Instalación Sanitaria Nave')
  })

  it('incluye todos los rubros opcionales encendidos', () => {
    const items = calcularItems(datos({
      incluye_cerramiento_lateral: true,
      incluye_portones: true,
      incluye_piso_industrial: true,
      incluye_instalacion_electrica: true,
      incluye_instalacion_sanitaria: true,
    }), CATALOGO)
    // estructura + cubierta + montaje + lateral + portón + piso + eléctrica + sanitaria
    expect(items).toHaveLength(8)
    const nombres = items.map((i) => i.descripcion)
    expect(nombres).toContain('Cerramiento Lateral Chapa')
    expect(nombres).toContain('Portón Corredizo Metálico')
    expect(nombres).toContain('Piso Hormigón H-25 c/cuarzo')
  })

  it('excluye el montaje si incluye_montaje es false', () => {
    const items = calcularItems(datos({ incluye_montaje: false }), CATALOGO)
    expect(items.some((i) => i.descripcion?.includes('Montaje'))).toBe(false)
  })

  it('sin fabricación no incluye estructura', () => {
    const items = calcularItems(datos({ incluye_fabricacion: false }), CATALOGO)
    expect(items.some((i) => i.descripcion?.includes('Estructura'))).toBe(false)
  })
})

describe('esRubroIncluido', () => {
  it('rechaza nombres vacíos', () => {
    expect(esRubroIncluido(undefined, 'x', datos())).toBe(false)
    expect(esRubroIncluido('x', undefined, datos())).toBe(false)
  })

  it('acepta rubros sin regla específica', () => {
    expect(esRubroIncluido('Ingeniería', 'Cálculo Estructural', datos())).toBe(true)
  })
})
