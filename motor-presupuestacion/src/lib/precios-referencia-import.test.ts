import { describe, it, expect } from 'vitest'
import { parsearPreciosReferencia } from './precios-referencia-import'

// Filas al estilo de la hoja de costos unitarios (columnas 0-based):
// [A, B=código, C=descripción, D, E=unidad, F=material, G=ejecución, H=total]
function fila(codigo: string, desc: string, unidad = '', mat = 0, eje = 0, total: number | null = null) {
  return [null, codigo, desc, null, unidad, mat, eje, total]
}

describe('parsearPreciosReferencia', () => {
  it('clasifica categorías e ítems y arrastra la categoría vigente', () => {
    const filas = [
      fila('01', 'PRELIMINARES DE OBRA'),
      fila('01.01', 'Cartel de Obra', 'm2', 36.2, 36.9, 73.1),
      fila('01.02', 'Cerco de Obra', 'm', 18.6, 13.5, 32.1),
      fila('07', 'REVOQUES'),
      fila('07.03', 'Exterior a la cal común completo', 'm2', 3.0, 16.2, 19.2),
    ]
    const { items, categorias } = parsearPreciosReferencia(filas as never)

    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({
      categoria: 'PRELIMINARES DE OBRA', codigo: '01.01', unidad: 'm2', costoTotalUsd: 73.1,
    })
    expect(items[2].categoria).toBe('REVOQUES')
    expect(categorias).toEqual([
      { nombre: 'PRELIMINARES DE OBRA', cantidad: 2 },
      { nombre: 'REVOQUES', cantidad: 1 },
    ])
  })

  it('completa el total con material + ejecución cuando falta', () => {
    const filas = [fila('03', 'ESTRUCTURAS'), fila('03.12', 'Hierros redondos', 'kg', 2.29, 3.81, null)]
    const { items } = parsearPreciosReferencia(filas as never)
    expect(items[0].costoTotalUsd).toBeCloseTo(6.1)
  })

  it('descarta filas sin unidad o con total no positivo', () => {
    const filas = [
      fila('02', 'MOVIMIENTO DE TIERRA'),
      fila('02.00', 'Encabezado sin unidad', '', 0, 0, 0),
      fila('02.01', 'Ítem sin precio', 'm3', 0, 0, 0),
    ]
    const { items } = parsearPreciosReferencia(filas as never)
    expect(items).toHaveLength(0)
  })
})
