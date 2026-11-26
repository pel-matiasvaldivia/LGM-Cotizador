import { describe, expect, it } from 'vitest'
import { fechaEntrega, normalizarCondiciones, normalizarDatosOrden } from './cierre'
import type { Contrato } from '@/db/schema'

function contrato(patch: Partial<Contrato> = {}): Contrato {
  return {
    id: 'c1',
    tenantId: 't1',
    proyectoId: 'p1',
    numero: 'CT-2026-2912',
    plazoEntregaDias: 90,
    fechaInicio: '',
    anticipoPct: 30,
    formaPago: '',
    lugarEntrega: '',
    garantiaMeses: 12,
    observaciones: '',
    montoSinIvaUsd: 0,
    ivaUsd: 0,
    montoTotalUsd: 0,
    tipoCambio: 0,
    snapshot: {},
    firmadoAt: null,
    firmadoPor: '',
    firmadoEmail: '',
    firmaMetodo: null,
    firmaReferencia: '',
    emitidoPor: null,
    createdAt: new Date(),
    ...patch,
  } as Contrato
}

function error(fn: () => unknown): { status: number; message: string } {
  try {
    fn()
  } catch (e) {
    return e as { status: number; message: string }
  }
  throw new Error('tendría que haber cortado')
}

describe('normalizarCondiciones', () => {
  const base = { plazoEntregaDias: 90, anticipoPct: 30 }

  it('exige el plazo de entrega: es lo que se compromete en el contrato', () => {
    expect(error(() => normalizarCondiciones({ ...base, plazoEntregaDias: 0 })).status).toBe(400)
    expect(error(() => normalizarCondiciones({ ...base, plazoEntregaDias: 'ya mismo' })).status).toBe(400)
  })

  it('rechaza un anticipo fuera de 0–100', () => {
    expect(error(() => normalizarCondiciones({ ...base, anticipoPct: 140 })).status).toBe(400)
    expect(error(() => normalizarCondiciones({ ...base, anticipoPct: -1 })).status).toBe(400)
    expect(error(() => normalizarCondiciones({ ...base, anticipoPct: 'mitad' })).status).toBe(400)
    expect(normalizarCondiciones({ ...base, anticipoPct: 0 }).anticipoPct).toBe(0)
    expect(normalizarCondiciones({ ...base, anticipoPct: 100 }).anticipoPct).toBe(100)
  })

  it('rechaza una fecha de inicio con otro formato', () => {
    expect(error(() => normalizarCondiciones({ ...base, fechaInicio: '01/03/2026' })).status).toBe(400)
    expect(normalizarCondiciones({ ...base, fechaInicio: '2026-03-01' }).fechaInicio).toBe('2026-03-01')
    // Sin fecha es válido: queda "a definir".
    expect(normalizarCondiciones(base).fechaInicio).toBe('')
  })

  it('recorta los textos largos y limita el plazo a un rango razonable', () => {
    const c = normalizarCondiciones({
      ...base,
      plazoEntregaDias: 99999,
      observaciones: 'x'.repeat(900),
    })
    expect(c.plazoEntregaDias).toBe(3650)
    expect(c.observaciones).toHaveLength(500)
  })
})

describe('fechaEntrega', () => {
  it('cuenta el plazo desde el inicio previsto', () => {
    expect(fechaEntrega(contrato({ fechaInicio: '2026-03-01', plazoEntregaDias: 90 })))
      .toBe('2026-05-30')
  })

  it('sin inicio previsto cuenta desde la firma', () => {
    const firmadoAt = new Date('2026-03-01T12:00:00Z')
    expect(fechaEntrega(contrato({ fechaInicio: '', plazoEntregaDias: 30, firmadoAt })))
      .toBe('2026-03-31')
  })
})

describe('normalizarDatosOrden', () => {
  it('sólo acepta las prioridades conocidas', () => {
    expect(normalizarDatosOrden({ prioridad: 'alta' }).prioridad).toBe('alta')
    expect(normalizarDatosOrden({ prioridad: 'urgentísimo' }).prioridad).toBe('normal')
    expect(normalizarDatosOrden({}).prioridad).toBe('normal')
  })
})
