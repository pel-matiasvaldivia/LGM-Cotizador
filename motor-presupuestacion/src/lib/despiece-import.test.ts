import { describe, expect, it } from 'vitest'
import { decodificar, filasDesdeCsv, interpretarDespiece, numeroArg } from './despiece-import'

// Estructura de producto como la exporta el ERP: el producto de la obra se
// abre en subconjuntos (CASABENE_*) y cada uno en artículos reales.
const ARBOL = [
  ['Estructura de Producto'],
  ['Artículo: CASABENE_1849,03 M2'],
  [],
  ['Código', 'Artículo', 'Unidades', 'Uni. Med.', 'Costo Unitario'],
  ['178', 'CASABENE_CUBIERTA DE TECHOS', '1,0000', 'UN', '3106029030,1776'],
  ['87', 'PERFIL C GALVANIZADO 140 X 60 X 20 X 3.2 (7.44 KG/M)', '11160,0000', 'KG', '1489,1100'],
  ['53', 'PERFIL C GALVANIZADO 140 X 60 X 20 X 2,0MM (4,46 KG/M)', '14986,0000', 'KG', '2140,0000'],
  ['2', 'CASABENE_VIGAS_V03', '1,0000', 'UN', '2932783118,7278'],
  ['9', 'PERFIL W 410X38.8 KG/M (W16X26)', '10709,0000', 'KG', '1334,7686'],
  ['11', 'HORMIGON ELABORADO H17', '80,0000', 'M3', '180000,0000'],
]

describe('numeroArg', () => {
  it('lee la coma decimal del ERP', () => {
    expect(numeroArg('11160,0000')).toBe(11160)
    expect(numeroArg('1.503,0000')).toBe(1503)
    expect(numeroArg('9.577')).toBe(9577)
    expect(numeroArg('9,577')).toBeCloseTo(9.577)
    expect(numeroArg(42)).toBe(42)
    expect(numeroArg('')).toBeNull()
  })
})

describe('interpretarDespiece', () => {
  it('separa los subconjuntos de los materiales por el prefijo de la obra', () => {
    const p = interpretarDespiece(ARBOL)
    expect(p.metodoSubconjunto).toBe('prefijo')
    expect(p.lineas).toHaveLength(4)
    expect(p.subconjuntos).toEqual(['CASABENE_CUBIERTA DE TECHOS', 'CASABENE_VIGAS_V03'])
    expect(p.omitidos.map((o) => o.descripcion)).toEqual([
      'CASABENE_CUBIERTA DE TECHOS',
      'CASABENE_VIGAS_V03',
    ])
  })

  it('cuelga cada material de su subconjunto y respeta unidades y cantidades', () => {
    const { lineas } = interpretarDespiece(ARBOL)
    expect(lineas[0]).toMatchObject({
      subconjunto: 'CASABENE_CUBIERTA DE TECHOS',
      codigo: '87',
      unidad: 'kg',
      cantidad: 11160,
    })
    expect(lineas[2]).toMatchObject({ subconjunto: 'CASABENE_VIGAS_V03', cantidad: 10709 })
    expect(lineas[3]).toMatchObject({ unidad: 'm3', cantidad: 80 })
  })

  it('usa la columna de subconjunto cuando la planilla la trae', () => {
    const p = interpretarDespiece([
      ['Subconjunto', 'Código', 'Descripción', 'Cantidad', 'Unidad'],
      ['Columnas', '9', 'PERFIL W 250X17,9', '1503', 'KG'],
      ['Columnas', '12', 'TUBO REDONDO 2 7/8', '8380,6', 'KG'],
    ])
    expect(p.metodoSubconjunto).toBe('columna')
    expect(p.lineas).toHaveLength(2)
    expect(p.lineas[1].cantidad).toBeCloseTo(8380.6)
  })

  it('agrupa por sangría cuando el árbol viene indentado', () => {
    const p = interpretarDespiece([
      ['Artículo', 'Unidades', 'Uni. Med.'],
      ['FUNDACIONES', '1', 'UN'],
      ['  HIERRO NERVADO 10 MM', '856,44', 'KG'],
      ['  HORMIGON H17', '80', 'M3'],
    ])
    expect(p.metodoSubconjunto).toBe('sangria')
    expect(p.lineas.map((l) => l.subconjunto)).toEqual(['FUNDACIONES', 'FUNDACIONES'])
  })

  it('descarta renglones sin cantidad y lo deja dicho', () => {
    const p = interpretarDespiece([
      ['Subconjunto', 'Descripción', 'Cantidad'],
      ['Techo', 'TORNILLO AUTOPERFORANTE', ''],
      ['Techo', 'ARANDELA PLANA 1/2', '0'],
      ['Techo', 'HIERRO LISO 10 MM', '263,52'],
    ])
    expect(p.lineas).toHaveLength(1)
    expect(p.omitidos.map((o) => o.motivo)).toEqual(['Sin cantidad', 'Cantidad cero'])
  })

  it('avisa cuando no encuentra los encabezados en vez de importar cualquier cosa', () => {
    const p = interpretarDespiece([['una', 'planilla'], ['que', 'no es']])
    expect(p.lineas).toHaveLength(0)
    expect(p.advertencias[0]).toContain('encabezados')
  })

  it('marca el artículo repetido dentro del mismo subconjunto', () => {
    const p = interpretarDespiece([
      ['Subconjunto', 'Código', 'Descripción', 'Cantidad'],
      ['Techo', '87', 'PERFIL C 140', '100'],
      ['Techo', '87', 'PERFIL C 140', '50'],
    ])
    expect(p.advertencias.join(' ')).toContain('más de una vez')
  })

  it('importa sin agrupar, avisando, si no hay forma de deducir el árbol', () => {
    const p = interpretarDespiece([
      ['Descripción', 'Cantidad', 'Unidad'],
      ['HIERRO LISO 12 MM', '506,88', 'KG'],
    ])
    expect(p.metodoSubconjunto).toBe('ninguno')
    expect(p.lineas).toHaveLength(1)
    expect(p.advertencias.join(' ')).toContain('agrupamiento')
  })
})

describe('filasDesdeCsv', () => {
  it('detecta el punto y coma, que es lo que exporta Excel en español', () => {
    const filas = filasDesdeCsv('Código;Artículo;Unidades\n87;"PERFIL C, 140";11160,0000\n')
    expect(filas[1]).toEqual(['87', 'PERFIL C, 140', '11160,0000'])
  })

  it('respeta las comillas escapadas', () => {
    const filas = filasDesdeCsv('a,b\n1,"TUBO 2 7/8"" REDONDO"\n')
    expect(filas[1][1]).toBe('TUBO 2 7/8" REDONDO')
  })
})

// Exportación real del ERP: cada celda es una fórmula de Excel (="..."),
// separador punto y coma, Windows-1252, y el árbol marcado con sangría dentro
// del propio texto de la descripción.
const ERP = `Código;Descripción;Unidades;Uni. Med.;Costo Uni.;Costo Tot.;Stock;% Merma;Subdepósito;

="04915 ";="CASABENE_PORTA TENSORES"; ;=" ";$ 185358,6880;$ 185358,6880;0,0000; ;=" ";
="04883";="          PORTA TENSOR TIPO T ";128,0000;="UN ";$ 1344,2963;$ 172069,9200;376,0000; ;=" ";
="02369";="                    PERFIL W 200X15 KG/M ";96,0000;="KG ";$ 1792,3950;$ 172069,9200;6866,0000; ;=" ";
="04916";="          BULON HXAGONAL 5/16\` X 1 3/8\` P/GRUESO ";320,0000;="UN ";$ 41,5274;$ 13288,7680;0,0000; ;=" ";
`

describe('estructura de producto del ERP', () => {
  it('desenvuelve las celdas con fórmula de Excel', () => {
    const p = interpretarDespiece(filasDesdeCsv(ERP))
    expect(p.metodoSubconjunto).toBe('sangria')
    expect(p.lineas.map((l) => l.codigo)).toEqual(['02369', '04916'])
  })

  it('toma como material la hoja del árbol, no el conjunto que la contiene', () => {
    // PORTA TENSOR TIPO T se fabrica con el perfil de abajo: contar los dos
    // duplicaría el acero.
    const { lineas, omitidos } = interpretarDespiece(filasDesdeCsv(ERP))
    expect(lineas).toHaveLength(2)
    expect(omitidos.map((o) => o.descripcion)).toContain('PORTA TENSOR TIPO T')
    expect(lineas[0].subconjunto).toBe('CASABENE_PORTA TENSORES › PORTA TENSOR TIPO T')
    expect(lineas[1].subconjunto).toBe('CASABENE_PORTA TENSORES')
  })

  it('trae el stock del ERP, con el negativo a cero', () => {
    const { lineas } = interpretarDespiece(filasDesdeCsv(ERP))
    expect(lineas[0].stock).toBe(6866)
    const negativo = interpretarDespiece(filasDesdeCsv(
      `Código;Descripción;Unidades;Uni. Med.;Stock\n="1";="PADRE"; ;=" ";0\n="2";="   UPN 100";64,0000;="KG ";-363,6000\n`,
    ))
    expect(negativo.lineas[0].stock).toBe(0)
  })

  it('no se rompe con la comilla de pulgada dentro de la descripción', () => {
    const { lineas } = interpretarDespiece(filasDesdeCsv(
      `Código;Descripción;Unidades;Uni. Med.;Stock\n="1";="CASABENE_ESCALERA"; ;=" ";0\n="01408";="   CHAPA ANTI. SEMILLA 1/8" (3,2 MM) (28,2 KG/M2) ";1137,0000;="KG ";586,5600\n`,
    ))
    expect(lineas).toHaveLength(1)
    expect(lineas[0].descripcion).toBe('CHAPA ANTI. SEMILLA 1/8" (3,2 MM) (28,2 KG/M2)')
    expect(lineas[0].cantidad).toBe(1137)
    expect(lineas[0].unidad).toBe('kg')
  })

  it('detecta la exportación con las columnas corridas y no se queda con su stock', () => {
    // Exportada con coma de separador y coma decimal: cada importe se parte en
    // dos y la unidad deja de caer en su columna.
    const rota = 'Código,Descripción,Unidades,Uni. Med.,Costo Uni.,Costo Tot.,Stock,% Merma,Subdepósito,,,,\n'
      + ',,,,,,,,,,,,\n'
      + '04315 ,CASABENE_VIGAS_V03, , ,$ 4156900931,2430,$ 4156900931,2430,1,0, , ,\n'
      + '03500,          PERFIL W 410X38.8 KG/M (W16X26) ,10709,0,KG ,$ 1866,990,$ 19984054,1910,138215,0, , \n'
    const p = interpretarDespiece(filasDesdeCsv(rota))
    expect(p.lineas).toHaveLength(1)
    expect(p.lineas[0].cantidad).toBe(10709)
    expect(p.lineas[0].unidad).toBe('kg')
    expect(p.lineas[0].stock).toBeNull()
    expect(p.advertencias.join(' ')).toContain('corridas')
  })

  it('elige el separador por el encabezado, no por las comas decimales', () => {
    const filas = filasDesdeCsv('a;b;c\n="x";1.234,56;2.000,00\n')
    expect(filas[1]).toHaveLength(3)
  })
})

describe('decodificar', () => {
  it('lee el Windows-1252 que exporta el ERP', () => {
    // "Código;Descripción" en cp1252: la ó es un solo byte 0xF3.
    const bytes = new Uint8Array([0x43, 0xf3, 0x64, 0x69, 0x67, 0x6f, 0x3b, 0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x70, 0x63, 0x69, 0xf3, 0x6e])
    expect(decodificar(bytes)).toBe('Código;Descripción')
  })

  it('deja intacto el UTF-8', () => {
    expect(decodificar(new TextEncoder().encode('Código'))).toBe('Código')
  })
})
