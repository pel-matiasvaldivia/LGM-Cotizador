import { describe, expect, it } from 'vitest'
import { normalizarDominioIngresado, validarDominio, validarSlug } from './plataforma'

describe('normalizarDominioIngresado', () => {
  it('acepta lo que se copia y pega de la barra del navegador', () => {
    expect(normalizarDominioIngresado('https://www.Acero-Sur.com/presupuestos')).toBe('acero-sur.com')
    expect(normalizarDominioIngresado('  ACEROSUR.COM:3000 ')).toBe('acerosur.com')
    expect(normalizarDominioIngresado('presupuestos.acerosur.com')).toBe('presupuestos.acerosur.com')
  })
})

describe('validarDominio', () => {
  it('exige un dominio con punto y sin basura', () => {
    expect(validarDominio('acerosur.com')).toBe('acerosur.com')
    expect(() => validarDominio('localhost')).toThrow()
    expect(() => validarDominio('no válido.com')).toThrow()
    expect(() => validarDominio('-mal.com')).toThrow()
    expect(() => validarDominio('')).toThrow()
  })
})

describe('validarSlug', () => {
  it('normaliza y rechaza lo que no sirve como identificador', () => {
    expect(validarSlug('Acero-Sur')).toBe('acero-sur')
    expect(() => validarSlug('a')).toThrow()           // demasiado corto
    expect(() => validarSlug('-acero')).toThrow()      // no puede arrancar con guión
    expect(() => validarSlug('acero sur')).toThrow()   // sin espacios
    expect(() => validarSlug('../etc')).toThrow()      // nada de rutas
  })
})
