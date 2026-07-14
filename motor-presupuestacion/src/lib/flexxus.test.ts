import { describe, it, expect } from 'vitest'
import { construirLineasFlexxus, generarCsvFlexxus } from './flexxus'

describe('construirLineasFlexxus', () => {
  it('rutea Material y MO a los subrubros Flexxus correctos y agrega por rubro', () => {
    const items = [
      { descripcion: 'Estructura Alma Llena', rubro_nombre: 'Estructura Metálica', costo_material_usd: 100, costo_mo_usd: 200 },
      { descripcion: 'Cubierta Chapa', rubro_nombre: 'Cerramiento Cubierta', costo_material_usd: 50, costo_mo_usd: 10 },
    ]
    const lineas = construirLineasFlexxus(items, 1, 1000)
    // Estructura (R50): material→349, MO→347
    expect(lineas).toContainEqual({ codigoRubro: 50, codigoSubrubro: 349, montoArs: 100000 })
    expect(lineas).toContainEqual({ codigoRubro: 50, codigoSubrubro: 347, montoArs: 200000 })
    // Cubierta (R52): material→354, MO→353
    expect(lineas).toContainEqual({ codigoRubro: 52, codigoSubrubro: 354, montoArs: 50000 })
    expect(lineas).toContainEqual({ codigoRubro: 52, codigoSubrubro: 353, montoArs: 10000 })
  })

  it('aplica el markup de la cascada al monto', () => {
    const items = [{ descripcion: 'x', rubro_nombre: 'Piso Industrial', costo_material_usd: 10, costo_mo_usd: 0 }]
    const [linea] = construirLineasFlexxus(items, 1.18, 1000)
    expect(linea.montoArs).toBeCloseTo(11800, 2)
  })

  it('rutea los fletes al rubro Logística (69/397)', () => {
    const items = [{ descripcion: 'Flete camión', rubro_nombre: null, costo_material_usd: 500, costo_mo_usd: 0 }]
    const [linea] = construirLineasFlexxus(items, 1, 1000)
    expect(linea).toEqual({ codigoRubro: 69, codigoSubrubro: 397, montoArs: 500000 })
  })

  it('agrupa dos ítems del mismo rubro/subrubro en una sola línea', () => {
    const items = [
      { descripcion: 'a', rubro_nombre: 'Movimiento de Suelo', costo_material_usd: 10, costo_mo_usd: 0 },
      { descripcion: 'b', rubro_nombre: 'Movimiento de Suelo', costo_material_usd: 5, costo_mo_usd: 0 },
    ]
    const lineas = construirLineasFlexxus(items, 1, 1000)
    const mat = lineas.filter((l) => l.codigoRubro === 48 && l.codigoSubrubro === 343)
    expect(mat).toHaveLength(1)
    expect(mat[0].montoArs).toBe(15000)
  })

  it('omite montos en cero', () => {
    const items = [{ descripcion: 'x', rubro_nombre: 'Piso Industrial', costo_material_usd: 10, costo_mo_usd: 0 }]
    const lineas = construirLineasFlexxus(items, 1, 1000)
    expect(lineas).toHaveLength(1) // solo material, MO=0 no genera línea
  })

  it('cubre rubros nuevos de Flexxus (Escaleras → 54)', () => {
    const items = [{ descripcion: 'Escalera metálica', rubro_nombre: 'Escaleras', costo_material_usd: 40, costo_mo_usd: 20 }]
    const lineas = construirLineasFlexxus(items, 1, 1000)
    expect(lineas).toContainEqual({ codigoRubro: 54, codigoSubrubro: 360, montoArs: 40000 }) // materiales
    expect(lineas).toContainEqual({ codigoRubro: 54, codigoSubrubro: 358, montoArs: 20000 }) // MO fabricación
  })

  it('separa MO Fabricación y Montaje cuando el ítem trae el desglose', () => {
    const items = [{
      descripcion: 'Estructura', rubro_nombre: 'Estructura Metálica',
      costo_material_usd: 0, costo_mo_usd: 0,
      costo_mo_fab_usd: 30, costo_mo_montaje_usd: 20,
    }]
    const lineas = construirLineasFlexxus(items, 1, 1000)
    expect(lineas).toContainEqual({ codigoRubro: 50, codigoSubrubro: 347, montoArs: 30000 }) // fab
    expect(lineas).toContainEqual({ codigoRubro: 50, codigoSubrubro: 348, montoArs: 20000 }) // montaje
  })
})

describe('generarCsvFlexxus', () => {
  it('produce el formato exacto que consume Flexxus (códigos con padding a 3)', () => {
    const lineas = [{ codigoRubro: 50, codigoSubrubro: 349, montoArs: 107048484.36 }]
    const csv = generarCsvFlexxus('00149', 124, lineas)
    const filas = csv.split('\n')
    expect(filas[0]).toBe('CodigoCliente,CodigoProyecto,CodigoRubro,CodigoSubRubro,Monto')
    expect(filas[1]).toBe('00149,124,050,349,107048484')
  })
})
