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
//   docker compose exec app node scripts/tenant.mjs superadmin <email> [--quitar]
//
// Lo mismo se hace desde la pantalla Plataforma del panel (más cómodo); este
// script es la vía de rescate cuando el panel no está disponible o todavía no
// hay ningún superadmin. La semilla es exactamente el mismo código que corre el
// panel: scripts/lib/semilla.mjs.
//
// `crear` deja la empresa lista pero vacía: sin usuarios ni catálogo. Para que
// pueda operar, después hay que correr `semilla <slug>` (catálogo y parámetros
// iniciales) y crear su admin con scripts/usuario.mjs (TENANT=<slug>).
import { createRequire } from 'node:module'
import { enTransaccion, sembrarEmpresa } from './lib/semilla.mjs'

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

// Catálogo y parámetros iniciales para una empresa nueva. La implementación es
// la compartida con el panel (scripts/lib/semilla.mjs): acá sólo se resuelve la
// empresa y se abre la transacción.
async function semilla(pool, slug) {
  const tenant = await buscarTenant(pool, slug)

  const r = await enTransaccion(pool, (query) => sembrarEmpresa(query, tenant.id))

  console.log(`✓ Parámetros de costeo: ${r.parametros} clave(s) inicializada(s) en "${slug}"`)
  if (r.yaTeniaCatalogo) {
    console.log(`La empresa "${slug}" ya tiene catálogo: no se toca.`)
  } else if (r.plantilla) {
    console.log(`✓ Catálogo copiado desde "${r.plantilla}" (${r.rubrosCopiados} rubros)`)
  } else {
    console.log('No hay otra empresa con catálogo para copiar: cargalo con la importación de Base 0.')
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

    case 'superadmin': {
      const email = String(args[0] || '').toLowerCase().trim()
      const quitar = args.includes('--quitar')
      if (!email) {
        console.error('Uso: node scripts/tenant.mjs superadmin <email> [--quitar]')
        process.exit(1)
      }
      const filtroTenant = process.env.TENANT
        ? ' AND tenant_id = (SELECT id FROM tenants WHERE slug = $2)'
        : ''
      const valores = process.env.TENANT ? [email, process.env.TENANT] : [email]
      const { rows } = await pool.query(
        `SELECT u.id, t.slug FROM usuarios u JOIN tenants t ON t.id = u.tenant_id
         WHERE u.email = $1${filtroTenant}`, valores)
      if (rows.length === 0) {
        console.error(`No hay ningún usuario con el email ${email}.`)
        process.exit(1)
      }
      if (rows.length > 1) {
        console.error(`Ese email existe en ${rows.length} empresas (${rows.map((r) => r.slug).join(', ')}).`)
        console.error('Indicar cuál con TENANT=<slug>.')
        process.exit(1)
      }
      await pool.query('UPDATE usuarios SET superadmin = $2 WHERE id = $1', [rows[0].id, !quitar])
      console.log(`✓ ${email} (${rows[0].slug}) ${quitar ? 'ya no administra' : 'administra'} la plataforma`)
      break
    }

    case 'semilla':
      await semilla(pool, String(args[0] || '').trim())
      break

    default:
      console.error('Comandos: listar | crear | dominio | quitar-dominio | activar | desactivar | semilla | superadmin')
      console.error('Ver el encabezado de scripts/tenant.mjs para los ejemplos.')
      process.exit(1)
  }

  await pool.end()
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
