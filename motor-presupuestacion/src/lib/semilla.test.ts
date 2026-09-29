import { describe, expect, it } from 'vitest'
// Módulo compartido con los scripts de operaciones: al recibir el acceso a la
// base como parámetro, se puede probar sin Postgres.
import {
  copiarCatalogo, parametrosIniciales, sembrarEmpresa, sembrarParametros,
  type Query, type ResultadoQuery,
} from '../../scripts/lib/semilla.mjs'

// Doble de `pg`: responde según el SQL que recibe y registra las llamadas.
function fakeQuery(respuestas: Array<{ match: RegExp; rows?: Record<string, unknown>[]; rowCount?: number }>) {
  const llamadas: Array<{ text: string; params: unknown[] }> = []

  const query: Query = async (text, params = []) => {
    llamadas.push({ text, params })
    const r = respuestas.find((x) => x.match.test(text))
    return { rows: r?.rows ?? [], rowCount: r?.rowCount ?? 1 } as ResultadoQuery
  }

  const sql = (patron: RegExp) => llamadas.filter((l) => patron.test(l.text))
  return { query, llamadas, sql }
}

describe('parametrosIniciales', () => {
  it('arma la cascada de precio por defecto', () => {
    const p = parametrosIniciales({})
    expect(p.tipo_cambio_usd).toBe(1050)
    expect(p.iva).toBe(0.21)
    expect(p.beneficio).toBe(0.1251)
    // Ninguna empresa nueva arranca con el código de cliente de otra.
    expect(p.codigo_cliente_flexxus).toBe('00000')
  })

  it('respeta el entorno del despliegue', () => {
    const p = parametrosIniciales({
      TIPO_CAMBIO_INICIAL: '1400',
      UBICACION_BASE: 'Godoy Cruz, Mendoza',
      CODIGO_CLIENTE_FLEXXUS: '00149',
    })
    expect(p.tipo_cambio_usd).toBe(1400)
    expect(p.ubicacion_base).toBe('Godoy Cruz, Mendoza')
    expect(p.codigo_cliente_flexxus).toBe('00149')
  })
})

describe('sembrarParametros', () => {
  it('inserta cada clave para el tenant, sin pisar las existentes', async () => {
    const { query, sql } = fakeQuery([])
    const insertados = await sembrarParametros(query, 'tenant-1', {})

    const inserts = sql(/INSERT INTO configuracion/)
    expect(inserts).toHaveLength(Object.keys(parametrosIniciales({})).length)
    expect(insertados).toBe(inserts.length)
    expect(inserts.every((i) => i.params[0] === 'tenant-1')).toBe(true)
    expect(inserts[0].text).toContain('ON CONFLICT (tenant_id, clave) DO NOTHING')
  })
})

describe('sembrarEmpresa', () => {
  it('no toca el catálogo si la empresa ya tiene uno', async () => {
    const { query, sql } = fakeQuery([
      { match: /count\(\*\)::int AS n FROM rubros/, rows: [{ n: 19 }] },
    ])
    const r = await sembrarEmpresa(query, 'tenant-1')

    expect(r.yaTeniaCatalogo).toBe(true)
    expect(r.rubrosCopiados).toBe(0)
    expect(r.plantilla).toBeNull()
    expect(sql(/INSERT INTO rubros/)).toHaveLength(0)
    // Los parámetros sí se revisan: la semilla también sirve para completarlos.
    expect(sql(/INSERT INTO configuracion/).length).toBeGreaterThan(0)
  })

  it('copia el catálogo de la empresa más antigua que tenga uno', async () => {
    const { query, sql } = fakeQuery([
      { match: /count\(\*\)::int AS n FROM rubros/, rows: [{ n: 0 }] },
      { match: /FROM tenants t\s+WHERE t\.id <> \$1/, rows: [{ id: 'plantilla-1', slug: 'logmetal' }] },
      { match: /SELECT id, nombre, codigo_flexxus, orden FROM rubros/, rows: [
        { id: 'r1', nombre: 'Estructura Metálica', codigo_flexxus: 50, orden: 1 },
        { id: 'r2', nombre: 'Portones', codigo_flexxus: 53, orden: 2 },
      ] },
      { match: /INSERT INTO rubros/, rows: [{ id: 'nuevo-rubro' }] },
      { match: /FROM subrubros WHERE rubro_id/, rows: [{ id: 's1', nombre: 'Alma Llena', codigo_flexxus: 349 }] },
      { match: /INSERT INTO subrubros/, rows: [{ id: 'nuevo-sub' }] },
    ])

    const r = await sembrarEmpresa(query, 'tenant-nuevo')

    expect(r.plantilla).toBe('logmetal')
    expect(r.rubrosCopiados).toBe(2)
    // Un rubro nuevo por cada rubro de la plantilla, en la empresa destino.
    const insertRubros = sql(/INSERT INTO rubros/)
    expect(insertRubros).toHaveLength(2)
    expect(insertRubros.every((i) => i.params[0] === 'tenant-nuevo')).toBe(true)
    // Y sus subrubros con sus ratios colgando del rubro nuevo, no del original.
    expect(sql(/INSERT INTO subrubros/).every((i) => i.params[0] === 'nuevo-rubro')).toBe(true)
    expect(sql(/INSERT INTO ratios_costos/).every((i) => i.params[0] === 'nuevo-sub')).toBe(true)
  })

  it('usa la plantilla indicada cuando se pide una', async () => {
    const { query, sql } = fakeQuery([
      { match: /count\(\*\)::int AS n FROM rubros/, rows: [{ n: 0 }] },
      { match: /SELECT id, slug FROM tenants WHERE id = \$1/, rows: [{ id: 'elegida', slug: 'acero-sur' }] },
      { match: /SELECT id, nombre, codigo_flexxus, orden FROM rubros/, rows: [] },
    ])

    const r = await sembrarEmpresa(query, 'tenant-nuevo', { plantillaId: 'elegida' })

    expect(r.plantilla).toBe('acero-sur')
    // No se buscó "la más antigua": se respetó la elegida.
    expect(sql(/WHERE t\.id <> \$1/)).toHaveLength(0)
  })

  it('sin ninguna empresa de dónde copiar, deja sólo los parámetros', async () => {
    const { query, sql } = fakeQuery([
      { match: /count\(\*\)::int AS n FROM rubros/, rows: [{ n: 0 }] },
    ])
    const r = await sembrarEmpresa(query, 'tenant-solo')

    expect(r.plantilla).toBeNull()
    expect(r.rubrosCopiados).toBe(0)
    expect(r.yaTeniaCatalogo).toBe(false)
    expect(sql(/INSERT INTO rubros/)).toHaveLength(0)
  })
})

describe('copiarCatalogo', () => {
  it('no copia nada si el origen no tiene rubros', async () => {
    const { query, sql } = fakeQuery([
      { match: /SELECT id, nombre, codigo_flexxus, orden FROM rubros/, rows: [] },
    ])
    expect(await copiarCatalogo(query, 'origen', 'destino')).toBe(0)
    expect(sql(/INSERT INTO/)).toHaveLength(0)
  })
})
