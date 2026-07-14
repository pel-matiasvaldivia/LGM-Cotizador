import { describe, expect, it } from 'vitest'
import { calcularItems, calcularResumen, esRubroIncluido, type DatosTecnicos, type RatioConCatalogo } from './calculator'
import { PARAMETROS_DEFAULT, type Parametros } from './parametros'

function ratio(
  rubroNombre: string,
  subrubroNombre: string,
  unidad: string,
  ratioCantidad: number,
  material: number,
  mo = 0,
): RatioConCatalogo {
  return {
    id: `ratio-${subrubroNombre}`,
    subrubroId: `sub-${subrubroNombre}`,
    unidad,
    ratioCantidad,
    precioMaterialUsd: material,
    precioMoUsd: mo,
    precioUnitarioArs: (material + mo) * 1000,
    precioUnitarioUsd: material + mo,
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
  ratio('Estructura Metálica', 'Estructura Alveolar', 'm2', 1, 19, 54),
  ratio('Estructura Metálica', 'Estructura Alma Llena', 'm2', 1, 20, 55),
  ratio('Estructura Metálica', 'Estructura Reticulada', 'm2', 1, 18, 50),
  ratio('Cerramiento Cubierta', 'Cubierta Chapa Trapezoidal', 'm2', 1, 14.5, 5),
  ratio('Cerramiento Cubierta', 'Cubierta Panel Sandwich', 'm2', 1, 32, 5),
  ratio('Cerramiento Lateral', 'Cerramiento Lateral Chapa', 'm2', 1, 13, 4),
  ratio('Portones', 'Portón Corredizo Metálico', 'uni', 1, 1500, 350),
  ratio('Piso Industrial', 'Piso Hormigón H-25 c/cuarzo', 'm2', 1, 20, 6),
  ratio('Instalación Eléctrica', 'Instalación Eléctrica Nave', 'm2', 1, 9.5),
  ratio('Instalación Sanitaria', 'Instalación Sanitaria Nave', 'm2', 1, 6),
  ratio('Montaje', 'Montaje en Obra', 'm2', 1, 0, 20),
]

const PARAMS: Parametros = { ...PARAMETROS_DEFAULT, tipoCambio: 1000 }

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
    const items = calcularItems(datos({ tipologia: 'ALVEOLAR' }), CATALOGO, PARAMS)
    const estructuras = items.filter((i) => i.descripcion?.includes('Estructura'))
    expect(estructuras).toHaveLength(1)
    expect(estructuras[0].descripcion).toBe('Estructura Alveolar')
  })

  it('cambia de estructura con la tipología ALMA_LLENA', () => {
    const items = calcularItems(datos({ tipologia: 'ALMA_LLENA' }), CATALOGO, PARAMS)
    const estructuras = items.filter((i) => i.descripcion?.includes('Estructura'))
    expect(estructuras.map((i) => i.descripcion)).toEqual(['Estructura Alma Llena'])
  })

  it('desglosa material y mano de obra por ítem', () => {
    const items = calcularItems(datos({ superficie_m2: 500 }), CATALOGO, PARAMS)
    const est = items.find((i) => i.descripcion === 'Estructura Alveolar')!
    expect(est.cantidad).toBe(500)
    expect(est.costoMaterialUsd).toBeCloseTo(500 * 19)
    expect(est.costoMoUsd).toBeCloseTo(500 * 54)
    expect(est.costoTotalUsd).toBeCloseTo(500 * 73)
  })

  it('la incidencia suma 1 sobre el costo directo', () => {
    const items = calcularItems(datos({ incluye_piso_industrial: true }), CATALOGO, PARAMS)
    const suma = items.reduce((s, i) => s + (i.incidencia || 0), 0)
    expect(suma).toBeCloseTo(1, 6)
  })

  it('multiplica portones por cantidad', () => {
    const items = calcularItems(datos({ incluye_portones: true, cantidad_portones: 3 }), CATALOGO, PARAMS)
    const porton = items.find((i) => i.descripcion?.includes('Portón'))!
    expect(porton.cantidad).toBe(3)
    expect(porton.costoTotalUsd).toBeCloseTo(3 * 1850)
  })

  it('agrega fletes solo si hay distancia y viajes configurados', () => {
    const sinDist = calcularItems(datos(), CATALOGO, PARAMS)
    expect(sinDist.some((i) => i.descripcion?.includes('Flete'))).toBe(false)

    const conDist = calcularItems(
      datos({ distancia_obra_km: 200 }),
      CATALOGO,
      { ...PARAMS, viajesCamion: 10, fleteCamionUsdKm: 1.76 },
    )
    const flete = conDist.find((i) => i.descripcion === 'Flete camión')!
    expect(flete.cantidad).toBe(10 * 200)
    expect(flete.costoMaterialUsd).toBeCloseTo(10 * 200 * 1.76)
  })

  it('excluye los rubros opcionales apagados', () => {
    const nombres = calcularItems(datos(), CATALOGO, PARAMS).map((i) => i.descripcion)
    expect(nombres).not.toContain('Cerramiento Lateral Chapa')
    expect(nombres).not.toContain('Piso Hormigón H-25 c/cuarzo')
  })

  it('sin fabricación no incluye estructura', () => {
    const items = calcularItems(datos({ incluye_fabricacion: false }), CATALOGO, PARAMS)
    expect(items.some((i) => i.descripcion?.includes('Estructura'))).toBe(false)
  })
})

describe('calcularResumen (cascada)', () => {
  it('reproduce la cascada de la planilla Base 0', () => {
    // Costo directo real de AUTO SHOP GUERRINI, con sus parámetros
    const items = [{ costoMaterialUsd: 838570.159, costoMoUsd: 0 }]
    const params: Parametros = {
      ...PARAMETROS_DEFAULT,
      iva: 0.21,
      costosIndirectos: 0.05,
      beneficio: 0.1251,
      desperdicios: 0,
      coeficienteZona: 0,
    }
    const r = calcularResumen(items, params, 3760)
    expect(r.costoDirectoUsd).toBeCloseTo(838570.159, 2)
    expect(r.subtotalUsd).toBeCloseTo(880498.667, 1)
    expect(r.totalSinIvaUsd).toBeCloseTo(990649.05, 0)
    expect(r.costoM2Usd).toBeCloseTo(234.18, 1)
    expect(r.precioM2Usd).toBeCloseTo(263.47, 1)
  })

  it('aplica desperdicios sobre materiales y coef. de zona sobre el directo', () => {
    const items = [{ costoMaterialUsd: 1000, costoMoUsd: 500 }]
    const params: Parametros = {
      ...PARAMETROS_DEFAULT,
      costosIndirectos: 0,
      beneficio: 0,
      iva: 0,
      desperdicios: 0.1, // +10% material
      coeficienteZona: 0.2, // +20% directo
    }
    const r = calcularResumen(items, params, 100)
    // (1000*1.1 + 500) * 1.2 = 1920
    expect(r.costoDirectoUsd).toBeCloseTo(1920)
  })

  it('resuelve el coeficiente de zona por ubicación', () => {
    const items = [{ costoMaterialUsd: 1000, costoMoUsd: 0 }]
    const params: Parametros = {
      ...PARAMETROS_DEFAULT,
      costosIndirectos: 0, beneficio: 0, iva: 0, coeficienteZona: 0,
      zonas: { neuquen: 0.15 },
    }
    const r = calcularResumen(items, params, 100, 'Neuquén Capital, Patagonia')
    expect(r.coefZona).toBe(0.15)
    expect(r.costoDirectoUsd).toBeCloseTo(1150)
  })
})

describe('esRubroIncluido', () => {
  it('rechaza nombres vacíos', () => {
    expect(esRubroIncluido(undefined, 'x', datos())).toBe(false)
    expect(esRubroIncluido('x', undefined, datos())).toBe(false)
  })

  it('acepta rubros sin regla específica', () => {
    expect(esRubroIncluido('Fundaciones', 'Hormigón H21', datos())).toBe(true)
    expect(esRubroIncluido('Honorarios', 'Proyecto Estructura', datos())).toBe(true)
    expect(esRubroIncluido('Logística', 'Fletes', datos())).toBe(true)
  })
})
