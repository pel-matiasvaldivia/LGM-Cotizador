import { describe, expect, it } from 'vitest'
import { baseSugerida, comparar, escalar, geometriaDe, medidaBase, type Geometria } from './explosion'
import type { DatosTecnicosRow, ObraReferencia, ObraReferenciaItem } from '@/db/schema'

// La obra real que sirve de patrón: 30 × 61,64 × 8 m, 1849,03 m².
function casabene(patch: Partial<ObraReferencia> = {}): ObraReferencia {
  return {
    id: 'o1',
    tenantId: 't1',
    proyectoId: null,
    nombre: 'Casabene',
    tipologia: 'ALVEOLAR',
    ancho: 30,
    largo: 61.634,
    alturaLibre: 8,
    superficie: 1849.03,
    tipoCubierta: '',
    tipoCerramiento: '',
    activa: true,
    notas: '',
    cargadaPor: null,
    createdAt: new Date(),
    ...patch,
  } as ObraReferencia
}

function item(patch: Partial<ObraReferenciaItem> = {}): ObraReferenciaItem {
  return {
    id: 'i1',
    obraId: 'o1',
    subconjunto: 'CASABENE_VIGAS_V03',
    codigo: '03500',
    descripcion: 'PERFIL W 410X38.8 KG/M (W16X26)',
    unidad: 'kg',
    cantidad: 10709,
    base: 'm2_cubierta',
    orden: 0,
    ...patch,
  } as ObraReferenciaItem
}

const obraNueva: Geometria = {
  tipologia: 'ALVEOLAR', ancho: 30, largo: 30.817, alturaLibre: 8, superficie: 924.5, cantidadPortones: 2,
}

describe('bases de escala', () => {
  it('cada base mide lo suyo', () => {
    const g = { tipologia: 'ALVEOLAR', ancho: 20, largo: 30, alturaLibre: 8, superficie: 600, cantidadPortones: 3 }
    expect(medidaBase('m2_cubierta', g)).toBe(600)
    expect(medidaBase('m2_lateral', g)).toBe(2 * 50 * 8)
    expect(medidaBase('ml_perimetro', g)).toBe(100)
    expect(medidaBase('unidad_porton', g)).toBe(3)
    expect(medidaBase('global', g)).toBe(1)
  })

  it('deduce la base por el nombre del subconjunto', () => {
    expect(baseSugerida('CASABENE_VIGAS_V03')).toBe('m2_cubierta')
    expect(baseSugerida('CASABENE_CIERRE LATERAL')).toBe('m2_lateral')
    expect(baseSugerida('CASABENE_TENSORES LATERALES')).toBe('m2_lateral')
    expect(baseSugerida('CASABENE_ZINGUERIA')).toBe('ml_perimetro')
    expect(baseSugerida('CASABENE_ESCALERA')).toBe('global')
    expect(baseSugerida('CASABENE_PORTONES')).toBe('unidad_porton')
  })
})

describe('escalar una obra de referencia', () => {
  it('lleva la estructura a la superficie nueva', () => {
    const { lineas } = escalar(casabene(), [item()], obraNueva)
    // La mitad de la superficie, la mitad del acero de cubierta.
    expect(lineas[0].cantidad).toBeCloseTo(5354.5, 0)
    expect(lineas[0].factor).toBeCloseTo(0.5, 3)
  })

  it('el cierre lateral no escala con la planta', () => {
    // La misma luz y altura, la mitad de largo: la superficie cae a la mitad
    // pero el perímetro, y con él el cierre, cae mucho menos.
    const { lineas } = escalar(
      casabene(),
      [item({ subconjunto: 'CASABENE_CIERRE LATERAL', base: 'm2_lateral', cantidad: 1000 })],
      obraNueva,
    )
    expect(lineas[0].factor).toBeGreaterThan(0.6)
    expect(lineas[0].factor).toBeLessThan(0.75)
  })

  it('lo que no escala, no escala', () => {
    const { lineas } = escalar(
      casabene(),
      [item({ subconjunto: 'CASABENE_ESCALERA', base: 'global', cantidad: 1137, descripcion: 'CHAPA ANTI.' })],
      obraNueva,
    )
    expect(lineas[0].cantidad).toBe(1137)
    expect(lineas[0].factor).toBe(1)
  })

  it('avisa cuando la referencia no tiene la medida que hace falta', () => {
    const sinAltura = casabene({ alturaLibre: 0 })
    const { lineas, advertencias } = escalar(
      sinAltura,
      [item({ base: 'm2_lateral' })],
      obraNueva,
    )
    expect(lineas[0].cantidad).toBe(0)
    expect(advertencias.join(' ')).toContain('cierre lateral')
  })

  it('redondea a dos decimales: más precisión que esa sería falsa', () => {
    const { lineas } = escalar(casabene(), [item({ cantidad: 1234.5678 })], obraNueva)
    expect(String(lineas[0].cantidad).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})

describe('elegir la obra más parecida', () => {
  it('la luz pesa más que la superficie', () => {
    // Una obra de la misma luz y el doble de superficie se parece más que una
    // de la misma superficie y otra luz: el juego de perfiles lo fija la luz.
    const mismaLuz = casabene({ id: 'a', ancho: 30, largo: 120, superficie: 3600 })
    const mismaSup = casabene({ id: 'b', ancho: 15, largo: 61.6, superficie: 924 })
    expect(comparar(obraNueva, mismaLuz).distancia).toBeLessThan(comparar(obraNueva, mismaSup).distancia)
  })

  it('otra tipología queda last', () => {
    const otra = casabene({ id: 'c', tipologia: 'RETICULADA' })
    const igual = casabene({ id: 'd', ancho: 22 })
    expect(comparar(obraNueva, otra).distancia).toBeGreaterThan(comparar(obraNueva, igual).distancia)
    expect(comparar(obraNueva, otra).motivos.join(' ')).toContain('RETICULADA')
  })

  it('la obra idéntica no tiene diferencias que contar', () => {
    const identica = casabene({ ancho: 30, largo: 30.817, alturaLibre: 8, superficie: 924.5 })
    expect(comparar(obraNueva, identica).motivos).toEqual([])
    expect(comparar(obraNueva, identica).distancia).toBeCloseTo(0, 5)
  })

  it('avisa cuando escala de otra tipología', () => {
    const { advertencias } = escalar(casabene({ tipologia: 'RETICULADA' }), [item()], obraNueva)
    expect(advertencias.join(' ')).toContain('otra tipología')
  })
})

describe('geometriaDe', () => {
  it('saca la superficie de ancho por largo si no viene cargada', () => {
    const g = geometriaDe({ ancho: 20, largo: 30, superficie: null, alturaLibre: 7, tipologia: 'alveolar' } as DatosTecnicosRow)
    expect(g.superficie).toBe(600)
    expect(g.tipologia).toBe('ALVEOLAR')
  })

  it('no se cae sin datos técnicos', () => {
    expect(geometriaDe(null).superficie).toBe(0)
  })
})
