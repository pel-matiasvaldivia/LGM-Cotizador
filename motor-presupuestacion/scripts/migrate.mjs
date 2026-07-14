// Corre las migraciones SQL de ./drizzle en orden y hace el seed inicial.
// Se ejecuta en el arranque del contenedor, antes de `node server.js`.
// Solo depende de `pg` (presente en el bundle standalone de Next).
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle')

// Mismo formato que src/lib/password.ts — mantener en sincronía
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

async function main() {
  // Preferir PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT (sin URL: cualquier
  // contraseña vale). DATABASE_URL queda como alternativa.
  let pool
  if (process.env.PGHOST) {
    pool = new Pool()
  } else if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  } else {
    console.error('[migrate] configurar PGHOST/PGUSER/PGPASSWORD/PGDATABASE (o DATABASE_URL)')
    process.exit(1)
  }

  // Esperar a que Postgres acepte conexiones (arranque en frío de docker compose)
  for (let i = 0; ; i++) {
    try {
      await pool.query('SELECT 1')
      break
    } catch (err) {
      // Errores de configuración: no tiene sentido reintentar
      if (err.code === 'ERR_INVALID_URL') {
        console.error('[migrate] DATABASE_URL inválida (¿contraseña con caracteres especiales?). Usar PGHOST/PGUSER/PGPASSWORD/PGDATABASE en su lugar.')
        process.exit(1)
      }
      if (err.code === '28P01' || err.code === '28000') {
        console.error('[migrate] autenticación rechazada por Postgres: revisar usuario/contraseña')
        process.exit(1)
      }
      if (i >= 30) throw err
      console.log(`[migrate] esperando a Postgres... (${i + 1}: ${err.message})`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file])
    if (rows.length > 0) continue

    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const statements = sql.split('--> statement-breakpoint')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const stmt of statements) {
        if (stmt.trim()) await client.query(stmt)
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`[migrate] aplicada ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`[migrate] falló ${file}:`, err.message)
      process.exit(1)
    } finally {
      client.release()
    }
  }

  await seedAdmin(pool)
  await seedCatalogo(pool)
  await pool.end()
  console.log('[migrate] listo')
}

// Crea el usuario admin inicial si la tabla está vacía.
// Credenciales por env: ADMIN_EMAIL / ADMIN_PASSWORD (nunca hardcodeadas).
async function seedAdmin(pool) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuarios')
  if (rows[0].n > 0) return

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.warn('[seed] sin usuarios y sin ADMIN_EMAIL/ADMIN_PASSWORD — no se creó admin')
    return
  }
  await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES ($1, $2, $3, 'admin')`,
    [email.toLowerCase(), hashPassword(password), 'Administrador']
  )
  console.log(`[seed] usuario admin creado: ${email}`)
}

// Catálogo mínimo de rubros/subrubros/ratios para que el cotizador funcione
// desde el primer arranque. Valores de ejemplo: ajustarlos desde /configuracion/ratios.
async function seedCatalogo(pool) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM rubros')
  if (rows[0].n > 0) return

  const catalogo = [
    ['Estructura Metálica', [
      ['Estructura Alveolar', 'kg/m2', 18, 12.6],
      ['Estructura Alma Llena', 'kg/m2', 28, 12.2],
      ['Estructura Reticulada', 'kg/m2', 15, 11.8],
    ]],
    ['Cerramiento Cubierta', [
      ['Cubierta Chapa Trapezoidal', 'm2', 1.05, 14.5],
      ['Cubierta Panel Sandwich', 'm2', 1.05, 32.0],
    ]],
    ['Cerramiento Lateral', [
      ['Cerramiento Lateral Chapa', 'm2', 0.8, 13.0],
    ]],
    ['Portones', [
      ['Portón Corredizo Metálico', 'uni', 1, 1850],
    ]],
    ['Piso Industrial', [
      ['Piso Hormigón H-25 c/cuarzo', 'm2', 1, 26.0],
    ]],
    ['Instalación Eléctrica', [
      ['Instalación Eléctrica Nave', 'm2', 1, 9.5],
    ]],
    ['Instalación Sanitaria', [
      ['Instalación Sanitaria Nave', 'm2', 1, 6.0],
    ]],
    ['Montaje', [
      ['Montaje en Obra', 'kg/m2', 18, 3.2],
    ]],
  ]

  const tipoCambio = Number(process.env.TIPO_CAMBIO_INICIAL || 1050)
  let ordenRubro = 1
  for (const [rubroNombre, items] of catalogo) {
    const { rows: [rubro] } = await pool.query(
      'INSERT INTO rubros (nombre, orden) VALUES ($1, $2) RETURNING id',
      [rubroNombre, ordenRubro++]
    )
    for (const [subNombre, unidad, ratio, usd] of items) {
      const { rows: [sub] } = await pool.query(
        'INSERT INTO subrubros (rubro_id, nombre) VALUES ($1, $2) RETURNING id',
        [rubro.id, subNombre]
      )
      await pool.query(
        `INSERT INTO ratios_costos (subrubro_id, unidad, ratio_cantidad, precio_unitario_usd, precio_unitario_ars)
         VALUES ($1, $2, $3, $4, $5)`,
        [sub.id, unidad, ratio, usd, usd * tipoCambio]
      )
    }
  }
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES ('tipo_cambio_usd', $1)
     ON CONFLICT (clave) DO NOTHING`,
    [JSON.stringify(tipoCambio)]
  )
  console.log('[seed] catálogo de rubros/ratios inicial creado (valores de ejemplo)')
}

main().catch((err) => {
  console.error('[migrate] error fatal:', err)
  process.exit(1)
})
