// Semilla de una empresa: los parámetros de costeo por defecto y un catálogo de
// rubros/ratios copiado de otra empresa como plantilla.
//
// ── Por qué está acá y en JS plano ────────────────────────────────
// Esta lógica la necesitan dos mundos distintos:
//   - la app (pantalla Plataforma → src/lib/plataforma.ts), y
//   - los scripts de operaciones (scripts/tenant.mjs, scripts/migrate.mjs),
//     que corren con `node` sobre la imagen standalone, donde `src/` no existe.
// Un módulo JS plano bajo scripts/ es lo único que ambos pueden importar: la app
// lo empaqueta en el build y la imagen lo copia junto al resto de scripts/.
// Los tipos para el lado TypeScript están en semilla.d.mts.
//
// El acceso a la base entra por `query(text, params) -> { rows }`, con la forma
// de `pg`: quien llama decide la conexión (y la transacción), así el mismo
// código sirve con el pool de la app y con el del script.

/**
 * Parámetros de costeo con los que arranca una empresa. Son el punto de partida
 * de la cascada de precio; después cada empresa los ajusta desde el panel.
 */
export function parametrosIniciales(env = process.env) {
  return {
    tipo_cambio_usd: Number(env.TIPO_CAMBIO_INICIAL || 1050),
    iva: 0.21,
    costos_indirectos: 0.05,
    beneficio: 0.1251,
    desperdicios: 0,
    coeficiente_zona: 0,
    flete_camion_usd_km: 1.76,
    flete_camioneta_usd_km: 1.76,
    viajes_camion: 0,
    viajes_camioneta: 0,
    ubicacion_base: env.UBICACION_BASE || '',
    // Exportación a Flexxus: código de cliente y base del correlativo de proyecto.
    codigo_cliente_flexxus: env.CODIGO_CLIENTE_FLEXXUS || '00000',
    flexxus_proyecto_base: Number(env.FLEXXUS_PROYECTO_BASE || 100),
    zonas: {},
  }
}

/** Inserta los parámetros que falten, sin pisar los que ya se configuraron. */
export async function sembrarParametros(query, tenantId, env = process.env) {
  let insertados = 0
  for (const [clave, valor] of Object.entries(parametrosIniciales(env))) {
    const { rowCount } = await query(
      `INSERT INTO configuracion (tenant_id, clave, valor) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, clave) DO NOTHING`,
      [tenantId, clave, JSON.stringify(valor)],
    )
    insertados += rowCount ?? 0
  }
  return insertados
}

/**
 * Copia el catálogo (rubros → subrubros → ratios) de una empresa a otra.
 * Devuelve cuántos rubros copió. Quien llama se encarga de la transacción.
 */
export async function copiarCatalogo(query, origenId, destinoId) {
  const { rows: rubros } = await query(
    'SELECT id, nombre, codigo_flexxus, orden FROM rubros WHERE tenant_id = $1 ORDER BY orden',
    [origenId],
  )

  for (const rubro of rubros) {
    const { rows: [nuevoRubro] } = await query(
      `INSERT INTO rubros (tenant_id, nombre, codigo_flexxus, orden)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [destinoId, rubro.nombre, rubro.codigo_flexxus, rubro.orden],
    )

    const { rows: subrubros } = await query(
      'SELECT id, nombre, codigo_flexxus FROM subrubros WHERE rubro_id = $1',
      [rubro.id],
    )
    for (const sub of subrubros) {
      const { rows: [nuevoSub] } = await query(
        'INSERT INTO subrubros (rubro_id, nombre, codigo_flexxus) VALUES ($1, $2, $3) RETURNING id',
        [nuevoRubro.id, sub.nombre, sub.codigo_flexxus],
      )
      await query(
        `INSERT INTO ratios_costos
           (subrubro_id, unidad, ratio_cantidad, precio_material_usd, precio_mo_usd,
            precio_mo_fab_usd, precio_mo_montaje_usd, precio_unitario_usd, precio_unitario_ars, vigente)
         SELECT $1, unidad, ratio_cantidad, precio_material_usd, precio_mo_usd,
            precio_mo_fab_usd, precio_mo_montaje_usd, precio_unitario_usd, precio_unitario_ars, vigente
         FROM ratios_costos WHERE subrubro_id = $2`,
        [nuevoSub.id, sub.id],
      )
    }
  }

  return rubros.length
}

/**
 * Deja a una empresa en condiciones de cotizar: parámetros de costeo y, si
 * todavía no tiene catálogo, una copia del de otra empresa (la indicada, o la
 * más antigua que tenga uno).
 *
 * Es idempotente: si ya tiene catálogo propio, no lo toca.
 */
export async function sembrarEmpresa(query, tenantId, opciones = {}) {
  const { plantillaId, env = process.env } = opciones

  const parametros = await sembrarParametros(query, tenantId, env)

  const { rows: propios } = await query(
    'SELECT count(*)::int AS n FROM rubros WHERE tenant_id = $1',
    [tenantId],
  )
  if (propios[0].n > 0) {
    return { parametros, rubrosCopiados: 0, plantilla: null, yaTeniaCatalogo: true }
  }

  const { rows: plantillas } = plantillaId
    ? await query('SELECT id, slug FROM tenants WHERE id = $1', [plantillaId])
    : await query(
        `SELECT t.id, t.slug FROM tenants t
         WHERE t.id <> $1 AND EXISTS (SELECT 1 FROM rubros r WHERE r.tenant_id = t.id)
         ORDER BY t.created_at LIMIT 1`,
        [tenantId],
      )

  const plantilla = plantillas[0]
  if (!plantilla || plantilla.id === tenantId) {
    return { parametros, rubrosCopiados: 0, plantilla: null, yaTeniaCatalogo: false }
  }

  const rubrosCopiados = await copiarCatalogo(query, plantilla.id, tenantId)
  return { parametros, rubrosCopiados, plantilla: plantilla.slug, yaTeniaCatalogo: false }
}

/**
 * Corre `fn` dentro de una transacción tomando una conexión del pool de `pg`.
 * Lo usan los dos lados para no repetir el BEGIN/COMMIT/ROLLBACK.
 */
export async function enTransaccion(pool, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resultado = await fn((text, params) => client.query(text, params))
    await client.query('COMMIT')
    return resultado
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
