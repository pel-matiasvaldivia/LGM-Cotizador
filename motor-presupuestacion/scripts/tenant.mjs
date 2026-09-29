// Administración de empresas (tenants) del servicio. Es la parte de plataforma:
// crear una empresa y decidir qué dominios resuelven a ella. El resto de sus
// datos —razón social, CUIT, domicilio, logo, colores, textos— los completa su
// propio admin desde el panel (Configuración → Empresa).
//
// Uso (dentro del contenedor app):
//   docker compose exec app node scripts/tenant.mjs listar
//   docker compose exec app node scripts/tenant.mjs crear <slug> "<Nombre>" [dominio[,dominio2]]
//   docker compose exec app node scripts/tenant.mjs dominio <slug> <dominio>
//   docker compose exec app node scripts/tenant.mjs quitar-dominio <dominio>
//   docker compose exec app node scripts/tenant.mjs activar <slug>
//   docker compose exec app node scripts/tenant.mjs desactivar <slug>
//   docker compose exec app node scripts/tenant.mjs semilla <slug>
//
// `crear` deja la empresa lista pero vacía: sin usuarios ni catálogo. Para que
// pueda operar, después hay que correr `semilla <slug>` (catálogo y parámetros
// iniciales) y crear su admin con scripts/usuario.mjs (TENANT=<slug>).
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

function normalizarDominio(host) {
  return String(host || '').trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')
}

function abrirPool() {
  const pool = process.env.PGHOST
    ? new Pool()
    : process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL })
      : null
  if (!pool) {
    console.error('Configurar PGHOST/PGUSER/PGPASSWORD/PGDATABASE (o DATABASE_URL)')
    process.exit(1)
  }
  return pool
}

async function buscarTenant(pool, slug) {
  const { rows } = await pool.query('SELECT id, slug, nombre, activo FROM tenants WHERE slug = $1', [slug])
  if (rows.length === 0) {
    console.error(`No existe la empresa "${slug}".`)
    process.exit(1)
  }
  return rows[0]
}

async function listar(pool) {
  const { rows } = await pool.query(`
    SELECT t.slug, t.nombre, t.activo, t.cuit,
           coalesce(string_agg(d.dominio, ', ' ORDER BY d.dominio), '—') AS dominios,
           (SELECT count(*) FROM usuarios u WHERE u.tenant_id = t.id) AS usuarios,
           (SELECT count(*) FROM proyectos p WHERE p.tenant_id = t.id) AS proyectos
    FROM tenants t
    LEFT JOIN tenant_dominios d ON d.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at
  `)
  if (rows.length === 0) {
    console.log('No hay empresas creadas.')
    return
  }
  for (const r of rows) {
    console.log(`${r.activo ? '●' : '○'} ${r.slug}  —  ${r.nombre}${r.cuit ? ` (CUIT ${r.cuit})` : ''}`)
    console.log(`    dominios: ${r.dominios}`)
    console.log(`    usuarios: ${r.usuarios} · proyectos: ${r.proyectos}`)
  }
}

async function crear(pool, slug, nombre, dominios) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    console.error('El slug debe ser minúsculas, números y guiones (ej: acero-sur).')
    process.exit(1)
  }
  if (!nombre) {
    console.error('Falta el nombre de la empresa.')
    process.exit(1)
  }

  const { rows: [tenant] } = await pool.query(
    `INSERT INTO tenants (slug, nombre) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id, slug`,
    [slug, nombre],
  )
  console.log(`✓ Empresa "${tenant.slug}" lista (${tenant.id})`)

  for (const dominio of dominios) {
    await asignarDominio(pool, tenant, dominio)
  }

  console.log('')
  console.log('Siguientes pasos:')
  console.log(`  1) node scripts/tenant.mjs semilla ${slug}          # catálogo y parámetros iniciales`)
  console.log(`  2) TENANT=${slug} node scripts/usuario.mjs <email> <password> admin`)
  console.log(`  3) el admin completa CUIT, domicilio, logo y colores en Configuración → Empresa`)
}

async function asignarDominio(pool, tenant, dominioCrudo) {
  const dominio = normalizarDominio(dominioCrudo)
  if (!dominio) return
  await pool.query(
    `INSERT INTO tenant_dominios (dominio, tenant_id) VALUES ($1, $2)
     ON CONFLICT (dominio) DO UPDATE SET tenant_id = EXCLUDED.tenant_id`,
    [dominio, tenant.id],
  )
  console.log(`✓ ${dominio} → ${tenant.slug}`)
}

// Catálogo y parámetros iniciales para una empresa nueva: copia el catálogo de
// la empresa más antigua (sirve de plantilla) o, si no hay de dónde, deja sólo
// los parámetros de costeo por defecto.
async function semilla(pool, slug) {
  const tenant = await buscarTenant(pool, slug)

  const { rows: [{ n }] } = await pool.query(
    'SELECT count(*)::int AS n FROM rubros WHERE tenant_id = $1', [tenant.id])
  if (n > 0) {
    console.log(`La empresa "${slug}" ya tiene catálogo (${n} rubros): no se toca.`)
  } else {
    const { rows: [plantilla] } = await pool.query(
      `SELECT t.id, t.slug FROM tenants t
       WHERE t.id <> $1 AND EXISTS (SELECT 1 FROM rubros r WHERE r.tenant_id = t.id)
       ORDER BY t.created_at LIMIT 1`,
      [tenant.id],
    )
    if (!plantilla) {
      console.log('No hay otra empresa con catálogo para copiar: cargalo con la importación de Base 0.')
    } else {
      await copiarCatalogo(pool, plantilla.id, tenant.id)
      console.log(`✓ Catálogo copiado desde "${plantilla.slug}"`)
    }
  }

  const defaults = {
    tipo_cambio_usd: Number(process.env.TIPO_CAMBIO_INICIAL || 1050),
    iva: 0.21,
    costos_indirectos: 0.05,
    beneficio: 0.1251,
    desperdicios: 0,
    coeficiente_zona: 0,
    flete_camion_usd_km: 1.76,
    flete_camioneta_usd_km: 1.76,
    viajes_camion: 0,
    viajes_camioneta: 0,
    ubicacion_base: '',
    codigo_cliente_flexxus: '00000',
    flexxus_proyecto_base: 100,
    zonas: {},
  }
  for (const [clave, valor] of Object.entries(defaults)) {
    await pool.query(
      `INSERT INTO configuracion (tenant_id, clave, valor) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, clave) DO NOTHING`,
      [tenant.id, clave, JSON.stringify(valor)],
    )
  }
  console.log(`✓ Parámetros de costeo inicializados para "${slug}"`)
}

async function copiarCatalogo(pool, origenId, destinoId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: rubros } = await client.query(
      'SELECT id, nombre, codigo_flexxus, orden FROM rubros WHERE tenant_id = $1 ORDER BY orden', [origenId])
    for (const rubro of rubros) {
      const { rows: [nuevo] } = await client.query(
        'INSERT INTO rubros (tenant_id, nombre, codigo_flexxus, orden) VALUES ($1, $2, $3, $4) RETURNING id',
        [destinoId, rubro.nombre, rubro.codigo_flexxus, rubro.orden],
      )
      const { rows: subs } = await client.query(
        'SELECT id, nombre, codigo_flexxus FROM subrubros WHERE rubro_id = $1', [rubro.id])
      for (const sub of subs) {
        const { rows: [nuevoSub] } = await client.query(
          'INSERT INTO subrubros (rubro_id, nombre, codigo_flexxus) VALUES ($1, $2, $3) RETURNING id',
          [nuevo.id, sub.nombre, sub.codigo_flexxus],
        )
        await client.query(
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
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function main() {
  const [comando, ...args] = process.argv.slice(2)
  const pool = abrirPool()

  switch (comando) {
    case 'listar':
      await listar(pool)
      break

    case 'crear': {
      const [slug, nombre, dominios = ''] = args
      await crear(pool, String(slug || '').trim(), nombre, dominios.split(',').filter(Boolean))
      break
    }

    case 'dominio': {
      const [slug, dominio] = args
      if (!slug || !dominio) {
        console.error('Uso: node scripts/tenant.mjs dominio <slug> <dominio>')
        process.exit(1)
      }
      await asignarDominio(pool, await buscarTenant(pool, slug), dominio)
      break
    }

    case 'quitar-dominio': {
      const dominio = normalizarDominio(args[0])
      const { rowCount } = await pool.query('DELETE FROM tenant_dominios WHERE dominio = $1', [dominio])
      console.log(rowCount > 0 ? `✓ ${dominio} desasignado` : `${dominio} no estaba asignado`)
      break
    }

    case 'activar':
    case 'desactivar': {
      const activo = comando === 'activar'
      const tenant = await buscarTenant(pool, args[0])
      await pool.query('UPDATE tenants SET activo = $2 WHERE id = $1', [tenant.id, activo])
      console.log(`✓ "${tenant.slug}" ${activo ? 'activada' : 'desactivada'}`)
      break
    }

    case 'semilla':
      await semilla(pool, String(args[0] || '').trim())
      break

    default:
      console.error('Comandos: listar | crear | dominio | quitar-dominio | activar | desactivar | semilla')
      console.error('Ver el encabezado de scripts/tenant.mjs para los ejemplos.')
      process.exit(1)
  }

  await pool.end()
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
