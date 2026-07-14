import { describe, expect, it } from 'vitest'
import { buildGeometria } from './geometry'
import { geometriaToDXF } from './dxf'
import { geometriaToIFC } from './ifc'

const DT = {
  ancho: 20,
  largo: 50,
  alturaLibre: 8,
  tipologia: 'Estructura Alveolar',
  incluyePortones: true,
  cantidadPortones: 2,
  incluyePiso: true,
}

describe('buildGeometria', () => {
  it('reparte los pórticos según el largo (~6 m por bahía)', () => {
    const g = buildGeometria(DT as never)
    // 50 / 6 ≈ 8 bahías → 9 ejes
    expect(g.nBahias).toBe(8)
    expect(g.ejesX).toHaveLength(9)
    expect(g.ejesX[0]).toBe(0)
    expect(g.ejesX.at(-1)).toBe(50)
  })

  it('genera 2 columnas y 2 cabios por pórtico + vigas longitudinales', () => {
    const g = buildGeometria(DT as never)
    const columnas = g.miembros.filter((m) => m.tipo === 'columna')
    const cabios = g.miembros.filter((m) => m.tipo === 'cabio')
    expect(columnas).toHaveLength(9 * 2)
    expect(cabios).toHaveLength(9 * 2)
    // 2 vigas de borde + 1 cumbrera longitudinales
    expect(g.miembros.filter((m) => m.tipo === 'viga_borde')).toHaveLength(2)
    expect(g.miembros.filter((m) => m.tipo === 'cumbrera')).toHaveLength(1)
  })

  it('eleva la cumbrera sobre la altura de alero según la pendiente', () => {
    const g = buildGeometria(DT as never)
    expect(g.cumbrera).toBeGreaterThan(g.altura)
    // altura 8 + (20/2)*0.10 = 9
    expect(g.cumbrera).toBeCloseTo(9, 5)
  })

  it('crea una apertura por cada portón indicado', () => {
    const g = buildGeometria(DT as never)
    expect(g.aperturas).toHaveLength(2)
    for (const ap of g.aperturas) expect(ap.ancho).toBeGreaterThan(0)
  })

  it('usa valores por defecto sensatos sin datos técnicos', () => {
    const g = buildGeometria(null)
    expect(g.ancho).toBe(20)
    expect(g.largo).toBe(50)
    expect(g.altura).toBe(8)
    expect(g.aperturas).toHaveLength(0)
  })

  it('ignora dimensiones no positivas', () => {
    const g = buildGeometria({ ancho: 0, largo: -5, alturaLibre: null } as never)
    expect(g.ancho).toBe(20)
    expect(g.largo).toBe(50)
    expect(g.altura).toBe(8)
  })
})

describe('geometriaToDXF', () => {
  it('produce un DXF válido con capas y entidades', () => {
    const g = buildGeometria(DT as never)
    const dxf = geometriaToDXF(g, { codigo: 'PROY-2026-1', cliente: 'ACME', tipologia: 'Alveolar' })
    expect(dxf.startsWith('0\nSECTION')).toBe(true)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
    expect(dxf).toContain('ENVOLVENTE')
    expect(dxf).toContain('SECCION')
    expect(dxf).toContain('PROY-2026-1')
    expect(dxf).toContain('\nLINE\n')
    expect(dxf).toContain('\nCIRCLE\n')
  })
})

describe('geometriaToIFC', () => {
  it('produce un STEP/IFC2x3 con la jerarquía espacial y elementos', () => {
    const g = buildGeometria(DT as never)
    const ifc = geometriaToIFC(g, { codigo: 'PROY-2026-1', cliente: "O'Brien SA", tipologia: 'Alveolar' })
    expect(ifc.startsWith('ISO-10303-21;')).toBe(true)
    expect(ifc.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true)
    expect(ifc).toContain("FILE_SCHEMA(('IFC2X3'))")
    expect(ifc).toContain('IFCPROJECT')
    expect(ifc).toContain('IFCBUILDINGSTOREY')
    expect(ifc).toContain('IFCCOLUMN')
    expect(ifc).toContain('IFCBEAM')
    expect(ifc).toContain('IFCEXTRUDEDAREASOLID')
    expect(ifc).toContain('IFCSLAB') // incluyePiso
    // comilla simple escapada en el nombre del cliente
    expect(ifc).toContain("O''Brien SA")
  })

  it('no emite losa si el proyecto no incluye piso', () => {
    const g = buildGeometria({ ...DT, incluyePiso: false } as never)
    const ifc = geometriaToIFC(g, { codigo: 'X', cliente: 'Y' })
    expect(ifc).not.toContain('IFCSLAB')
  })
})
