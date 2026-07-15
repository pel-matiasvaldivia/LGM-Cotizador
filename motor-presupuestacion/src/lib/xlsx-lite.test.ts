import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { leerXlsx } from './xlsx-lite'
import { parsearBase0 } from './base0-import'

// Archivo Base 0 real del repo (si está presente en el checkout).
const BASE0 = path.join(process.cwd(), '..', 'datos', 'PRESUPUESTO_BASE_0_REV2.xlsx')

describe('leerXlsx', () => {
  it('lee las hojas y el contenido de un .xlsx real', () => {
    if (!existsSync(BASE0)) return // el archivo de datos puede no estar en CI
    const hojas = leerXlsx(readFileSync(BASE0))

    // Debe encontrar la hoja BASE 0 con su taxonomía de rubros.
    const base0 = hojas.find((h) => h.nombre.trim() === 'BASE 0')
    expect(base0).toBeTruthy()

    const texto = base0!.filas.flat().filter((v) => typeof v === 'string') as string[]
    expect(texto.some((t) => /HONORARIOS/i.test(t))).toBe(true)
    expect(texto.some((t) => /ESTRUCTURA METALICA/i.test(t))).toBe(true)
    expect(texto.some((t) => /MO FABRICACION/i.test(t))).toBe(true)
    expect(texto.some((t) => /MO MONTAJE/i.test(t))).toBe(true)
  })

  // Regresión: los .xlsx de openpyxl ordenan los atributos de <Relationship>
  // distinto a Excel (Id al final) y usan Target absoluto ("/xl/..."). El lector
  // debe resolver la hoja igual en ambos casos.
  it('lee un .xlsx generado por openpyxl (orden de atributos y Target absoluto)', () => {
    const fixture = path.join(process.cwd(), 'src', 'lib', 'fixtures', 'base0-openpyxl.xlsx')
    const hojas = leerXlsx(readFileSync(fixture))
    expect(hojas.map((h) => h.nombre)).toContain('BASE 0')

    const base0 = hojas.find((h) => h.nombre === 'BASE 0')!
    const preview = parsearBase0(base0.filas)
    const est = preview.rubros.find((r) => r.nombreOriginal === 'ESTRUCTURA METALICA')!
    expect(est.codigoFlexxus).toBe(50)
    expect(est.materialUsdM2).toBe(15)
    expect(est.moFabUsdM2).toBe(30)
    expect(est.moMontajeUsdM2).toBe(20)
  })
})
