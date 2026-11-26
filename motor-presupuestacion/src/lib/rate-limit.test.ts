import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  exigirLimite, exigirLimitePorClave, ipDelRequest, limitar, LimiteExcedido, resetLimites,
} from './rate-limit'

beforeEach(() => resetLimites())
afterEach(() => vi.useRealTimers())

function pedido(headers: Record<string, string> = {}): Request {
  return new Request('https://empresa.test/api/estimate', { method: 'POST', headers })
}

describe('limitar', () => {
  it('deja pasar hasta el máximo y después corta', () => {
    const limite = { max: 3, ventanaMs: 60_000 }
    expect(limitar('k', limite).ok).toBe(true)
    expect(limitar('k', limite).ok).toBe(true)
    expect(limitar('k', limite).restantes).toBe(0)
    expect(limitar('k', limite).ok).toBe(false)
  })

  it('cada clave lleva su propia cuenta', () => {
    const limite = { max: 1, ventanaMs: 60_000 }
    expect(limitar('uno', limite).ok).toBe(true)
    expect(limitar('uno', limite).ok).toBe(false)
    // Otra IP (u otra cuenta) no paga el bloqueo de la primera.
    expect(limitar('dos', limite).ok).toBe(true)
  })

  it('la ventana es deslizante: al vencer vuelve a permitir', () => {
    vi.useFakeTimers()
    const limite = { max: 2, ventanaMs: 1000 }
    expect(limitar('k', limite).ok).toBe(true)
    expect(limitar('k', limite).ok).toBe(true)
    expect(limitar('k', limite).ok).toBe(false)

    vi.advanceTimersByTime(1001)
    expect(limitar('k', limite).ok).toBe(true)
  })

  it('dice cuántos segundos falta esperar', () => {
    vi.useFakeTimers()
    const limite = { max: 1, ventanaMs: 10_000 }
    limitar('k', limite)
    vi.advanceTimersByTime(4000)
    expect(limitar('k', limite).reintentarEn).toBe(6)
  })
})

describe('ipDelRequest', () => {
  it('usa el primer valor de X-Forwarded-For (el que puso el proxy externo)', () => {
    expect(ipDelRequest(pedido({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5')
  })

  it('cae a X-Real-IP y, si no hay nada, a un valor fijo', () => {
    expect(ipDelRequest(pedido({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
    expect(ipDelRequest(pedido())).toBe('desconocida')
  })
})

describe('exigirLimite', () => {
  it('lanza 429 con el tiempo de espera al pasarse', () => {
    const req = pedido({ 'x-forwarded-for': '203.0.113.5' })
    const limite = { max: 1, ventanaMs: 60_000 }

    exigirLimite(req, 'prueba', limite)
    try {
      exigirLimite(req, 'prueba', limite)
      throw new Error('tendría que haber cortado')
    } catch (e) {
      expect(e).toBeInstanceOf(LimiteExcedido)
      expect((e as LimiteExcedido).status).toBe(429)
      expect((e as LimiteExcedido).reintentarEn).toBeGreaterThan(0)
    }
  })

  it('el mismo límite en rutas distintas no se pisa', () => {
    const req = pedido({ 'x-forwarded-for': '203.0.113.5' })
    const limite = { max: 1, ventanaMs: 60_000 }
    exigirLimite(req, 'login', limite)
    // Otra ruta, misma IP: cuenta aparte.
    expect(() => exigirLimite(req, 'registro', limite)).not.toThrow()
  })

  it('el límite por cuenta ignora la IP: rotarlas no lo evade', () => {
    const limite = { max: 1, ventanaMs: 60_000 }

    exigirLimitePorClave('login-cuenta', limite, 'victima@empresa.test')
    // Otra IP probando la MISMA cuenta ya está bloqueada.
    expect(() => exigirLimitePorClave('login-cuenta', limite, 'victima@empresa.test')).toThrow()
    // Pero otra cuenta sigue pudiendo entrar.
    expect(() => exigirLimitePorClave('login-cuenta', limite, 'otro@empresa.test')).not.toThrow()
  })

  it('el email no distingue mayúsculas ni espacios', () => {
    const limite = { max: 1, ventanaMs: 60_000 }
    exigirLimitePorClave('login-cuenta', limite, ' Victima@Empresa.test ')
    expect(() => exigirLimitePorClave('login-cuenta', limite, 'victima@empresa.test')).toThrow()
  })
})
