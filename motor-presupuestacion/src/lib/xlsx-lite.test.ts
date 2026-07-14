import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { leerXlsx } from './xlsx-lite'

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
})
