import { describe, expect, it } from 'vitest'
import { estaVerificado, exigirVerificado, linkVerificacion } from './verificacion'
import type { Usuario } from '@/db/schema'

function usuario(patch: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    tenantId: 't1',
    email: 'cliente@empresa.test',
    passwordHash: 'scrypt:x:y',
    nombre: 'Cliente',
    rol: 'cliente',
    superadmin: false,
    emailVerificadoAt: null,
    verificacionTokenHash: null,
    verificacionExpira: null,
    createdAt: new Date(),
    ...patch,
  } as Usuario
}

describe('estaVerificado', () => {
  it('al cliente se le exige confirmar; al staff no', () => {
    expect(estaVerificado(usuario())).toBe(false)
    expect(estaVerificado(usuario({ emailVerificadoAt: new Date() }))).toBe(true)
    // Al staff lo da de alta alguien de adentro: no hay nada que confirmar.
    expect(estaVerificado(usuario({ rol: 'comercial' }))).toBe(true)
    expect(estaVerificado(usuario({ rol: 'admin' }))).toBe(true)
  })
})

describe('exigirVerificado', () => {
  it('corta con 403 si el cliente no confirmó', () => {
    try {
      exigirVerificado(usuario())
      throw new Error('tendría que haber cortado')
    } catch (e) {
      expect((e as { status: number }).status).toBe(403)
    }
  })

  it('deja pasar al cliente confirmado', () => {
    expect(() => exigirVerificado(usuario({ emailVerificadoAt: new Date() }))).not.toThrow()
  })
})

describe('linkVerificacion', () => {
  it('arma el enlace sobre la URL del sitio', () => {
    expect(linkVerificacion('https://cotizador.test', 'abc123'))
      .toBe('https://cotizador.test/api/auth/verificar?token=abc123')
  })
})
