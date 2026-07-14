import { describe, it, expect } from 'vitest'
import { parsearBase0 } from './base0-import'

// Simula la matriz de filas que xlsx-lite produce para una Base 0 con valores
// USD/m² cargados en la 3ra columna (layout real: rubro col A, subrubro col B,
// valor col C).
function fila(a: string | null, b: string | null, c: number | null) {
  return [a, b, c] as Array<string | number | null>
}

describe('parsearBase0', () => {
  const filas = [
    fila('SISTEMA PROFESIONAL DE COSTOS', null, null),
    fila('5. ESTRUCTURA METALICA', null, null),
    fila(null, 'MATERIAL', 15),
    fila(null, 'MO FABRICACION', 30),
    fila(null, 'MO MONTAJE', 20),
    fila('11. ZINGUERIA', null, null),
    fila(null, 'MATERIAL', 0.3),
    fila(null, 'MO', 0.77),
    fila('1. HONORARIOS', null, null),
    fila(null, 'Arquitectura', 5),
    fila(null, 'Ingeniería estructural', 8),
    fila('99. RUBRO INEXISTENTE', null, null),
    fila(null, 'MATERIAL', 100),
  ]

  it('separa MATERIAL / MO FABRICACIÓN / MO MONTAJE por rubro', () => {
    const { rubros } = parsearBase0(filas)
    const estructura = rubros.find((r) => r.nombreOriginal === 'ESTRUCTURA METALICA')!
    expect(estructura.codigoFlexxus).toBe(50)
    expect(estructura.materialUsdM2).toBe(15)
    expect(estructura.moFabUsdM2).toBe(30)
    expect(estructura.moMontajeUsdM2).toBe(20)
    expect(estructura.totalUsdM2).toBe(65)
  })

  it('rutea MO combinada al bucket de fabricación', () => {
    const { rubros } = parsearBase0(filas)
    const zing = rubros.find((r) => r.nombreOriginal === 'ZINGUERIA')!
    expect(zing.codigoFlexxus).toBe(56)
    expect(zing.materialUsdM2).toBeCloseTo(0.3)
    expect(zing.moFabUsdM2).toBeCloseTo(0.77)
    expect(zing.moMontajeUsdM2).toBe(0)
  })

  it('interpreta subrubros sin etiqueta clara de rubros MO como mano de obra', () => {
    const { rubros } = parsearBase0(filas)
    const hon = rubros.find((r) => r.nombreOriginal === 'HONORARIOS')!
    expect(hon.codigoFlexxus).toBe(46)
    expect(hon.moFabUsdM2).toBe(13) // 5 + 8
    expect(hon.materialUsdM2).toBe(0)
  })

  it('marca los rubros sin código Flexxus pero conserva el valor', () => {
    const { rubros, sinMapear } = parsearBase0(filas)
    expect(sinMapear).toContain('RUBRO INEXISTENTE')
    const huerfano = rubros.find((r) => r.nombreOriginal === 'RUBRO INEXISTENTE')!
    expect(huerfano.codigoFlexxus).toBeNull()
    expect(huerfano.materialUsdM2).toBe(100)
  })

  it('descarta rubros sin valores', () => {
    const { rubros } = parsearBase0([
      fila('2. PRELIMINARES', null, null),
      fila(null, 'Obrador', null),
    ])
    expect(rubros).toHaveLength(0)
  })
})
