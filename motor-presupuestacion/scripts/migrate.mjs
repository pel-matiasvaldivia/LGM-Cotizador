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
  await seedParametros(pool)
  await pool.end()
  console.log('[migrate] listo')
}

// Garantiza que el usuario admin maestro exista en cada arranque (idempotente).
// Si el email ya existe NO se toca su contraseña (puede haberse cambiado desde
// el panel). Si falta, se crea. Override con ADMIN_EMAIL / ADMIN_PASSWORD.
// Con ADMIN_FORCE_RESET=true, además resetea su contraseña al valor de env.
async function seedAdmin(pool) {
  const email = (process.env.ADMIN_EMAIL || 'admin@logmetal.com.ar').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'L4gm2t1l_2026'

  const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email])
  if (rows.length > 0) {
    if (process.env.ADMIN_FORCE_RESET === 'true') {
      await pool.query(`UPDATE usuarios SET password_hash = $2, rol = 'admin' WHERE email = $1`, [
        email,
        hashPassword(password),
      ])
      console.log(`[seed] contraseña del admin maestro reseteada (ADMIN_FORCE_RESET): ${email}`)
    }
    return
  }

  await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES ($1, $2, $3, 'admin')`,
    [email, hashPassword(password), 'Administrador']
  )
  console.log(`[seed] usuario admin maestro creado: ${email}`)
}

// Catálogo inicial de rubros/subrubros/ratios. Valores por m² calibrados a
// partir de un presupuesto Base 0 real (ajustables desde /configuracion/ratios).
// Cada subrubro: [nombre, unidad, ratioCantidad, materialUsd, moUsd]
async function seedCatalogo(pool) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM rubros')
  if (rows[0].n > 0) return

  const catalogo = [
    ['Honorarios', [
      ['Honorarios y dirección de obra', 'm2', 1, 0, 13.1],
    ]],
    ['Preliminares', [
      ['Obrador, replanteo y varios', 'm2', 1, 0, 0.85],
    ]],
    ['Movimiento de Suelo', [
      ['Excavación, relleno y compactación', 'm2', 1, 7.62, 4.47],
    ]],
    ['Fundaciones', [
      ['Hormigón, hierros y pilotes', 'm2', 1, 7.7, 7.78],
    ]],
    ['Estructura Metálica', [
      ['Estructura Alveolar', 'm2', 1, 15.0, 30.0],
      ['Estructura Alma Llena', 'm2', 1, 19.4, 34.1],
      ['Estructura Reticulada', 'm2', 1, 13.0, 26.0],
    ]],
    ['Cerramiento Lateral', [
      ['Cerramiento Lateral Chapa', 'm2', 1, 17.7, 4.4],
    ]],
    ['Cerramiento Cubierta', [
      ['Cubierta Chapa Trapezoidal', 'm2', 1, 24.3, 6.5],
      ['Cubierta Panel Sandwich', 'm2', 1, 40.0, 6.5],
    ]],
    ['Zinguería', [
      ['Zinguería y babetas', 'm2', 1, 0.3, 0.77],
    ]],
    ['Portones', [
      ['Portón Corredizo Metálico', 'uni', 1, 1500, 350],
    ]],
    ['Piso Industrial', [
      ['Piso Hormigón H-25 c/cuarzo', 'm2', 1, 20.1, 5.11],
    ]],
    ['Veredín', [
      ['Veredín perimetral H-25', 'm2', 1, 1.76, 1.45],
    ]],
    ['Instalación Eléctrica', [
      ['Instalación Eléctrica Nave', 'm2', 1, 9.5, 0],
    ]],
    ['Instalación Sanitaria', [
      ['Instalación Sanitaria Nave', 'm2', 1, 6.0, 0],
    ]],
    ['Montaje', [
      ['Montaje en Obra', 'm2', 1, 0, 20.0],
    ]],
    ['Final de Obra', [
      ['Limpieza final y puesta en marcha', 'm2', 1, 0, 1.9],
    ]],
  ]

  const tipoCambio = Number(process.env.TIPO_CAMBIO_INICIAL || 1050)
  let ordenRubro = 1
  for (const [rubroNombre, items] of catalogo) {
    const { rows: [rubro] } = await pool.query(
      'INSERT INTO rubros (nombre, orden) VALUES ($1, $2) RETURNING id',
      [rubroNombre, ordenRubro++]
    )
    for (const [subNombre, unidad, ratio, material, mo] of items) {
      const { rows: [sub] } = await pool.query(
        'INSERT INTO subrubros (rubro_id, nombre) VALUES ($1, $2) RETURNING id',
        [rubro.id, subNombre]
      )
      const total = material + mo
      await pool.query(
        `INSERT INTO ratios_costos
           (subrubro_id, unidad, ratio_cantidad, precio_material_usd, precio_mo_usd, precio_unitario_usd, precio_unitario_ars)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sub.id, unidad, ratio, material, mo, total, total * tipoCambio]
      )
    }
  }
  console.log('[seed] catálogo de rubros/ratios inicial creado (calibrado, con material/MO)')
}

// Parámetros globales del costeo (cascada directo → indirectos → beneficio → IVA).
// Se insertan solo si faltan; no pisan valores ya configurados.
async function seedParametros(pool) {
  const tipoCambio = Number(process.env.TIPO_CAMBIO_INICIAL || 1050)
  const defaults = {
    tipo_cambio_usd: tipoCambio,
    iva: 0.21,
    costos_indirectos: 0.05,
    beneficio: 0.1251,
    desperdicios: 0,
    coeficiente_zona: 0,
    flete_camion_usd_km: 1.76,
    flete_camioneta_usd_km: 1.76,
    viajes_camion: 0,
    viajes_camioneta: 0,
    zonas: {},
  }
  for (const [clave, valor] of Object.entries(defaults)) {
    await pool.query(
      `INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING`,
      [clave, JSON.stringify(valor)]
    )
  }
  console.log('[seed] parámetros de costeo inicializados')
}

main().catch((err) => {
  console.error('[migrate] error fatal:', err)
  process.exit(1)
})
