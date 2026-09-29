// Crea o resetea un usuario de staff (admin / comercial) o cualquier rol.
// Útil porque el registro público solo crea rol 'cliente' y el seed inicial
// solo corre con la tabla vacía.
//
// Multi-tenant: el usuario se crea en una empresa. Con una sola empresa en la
// base se usa esa; si hay varias, hay que indicar el slug con TENANT=<slug>.
//
// Uso (dentro del contenedor app):
//   docker compose exec app node scripts/usuario.mjs <email> <password> [rol] [nombre]
//   docker compose exec -e TENANT=acero-sur app node scripts/usuario.mjs ...
//
// Ejemplos:
//   docker compose exec app node scripts/usuario.mjs comercial@logmetal.com 'L4gm2t1l_2026' comercial 'Equipo Comercial'
//   docker compose exec app node scripts/usuario.mjs admin@logmetal.com 'NuevaClave_2026' admin
//
// Si el email ya existe, actualiza contraseña, rol y nombre (upsert).
import { randomBytes, scryptSync } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const ROLES = ['admin', 'comercial', 'cliente']

// Mismo formato que src/lib/password.ts — mantener en sincronía
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

async function main() {
  const [emailArg, password, rolArg = 'comercial', nombreArg] = process.argv.slice(2)
  const email = (emailArg || '').toLowerCase().trim()
  const rol = (rolArg || '').toLowerCase().trim()
  const nombre = nombreArg || (rol === 'admin' ? 'Administrador' : 'Usuario')

  if (!email || !password) {
    console.error('Uso: node scripts/usuario.mjs <email> <password> [rol] [nombre]')
    console.error(`  rol: ${ROLES.join(' | ')} (por defecto: comercial)`)
    process.exit(1)
  }
  if (!ROLES.includes(rol)) {
    console.error(`Rol inválido "${rol}". Usar: ${ROLES.join(' | ')}`)
    process.exit(1)
  }

  const pool = process.env.PGHOST
    ? new Pool()
    : process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL })
      : null
  if (!pool) {
    console.error('Configurar PGHOST/PGUSER/PGPASSWORD/PGDATABASE (o DATABASE_URL)')
    process.exit(1)
  }

  const tenant = await resolverTenant(pool)

  const { rowCount } = await pool.query(
    `UPDATE usuarios SET password_hash = $3, rol = $4, nombre = $5
     WHERE tenant_id = $1 AND email = $2`,
    [tenant.id, email, hashPassword(password), rol, nombre]
  )

  if (rowCount > 0) {
    console.log(`✓ Usuario actualizado en "${tenant.slug}": ${email} (rol: ${rol})`)
  } else {
    await pool.query(
      `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol) VALUES ($1, $2, $3, $4, $5)`,
      [tenant.id, email, hashPassword(password), nombre, rol]
    )
    console.log(`✓ Usuario creado en "${tenant.slug}": ${email} (rol: ${rol})`)
  }

  await pool.end()
}

// Empresa donde se crea el usuario: TENANT=<slug>, o la única que haya.
async function resolverTenant(pool) {
  const slug = (process.env.TENANT || '').trim()
  if (slug) {
    const { rows } = await pool.query('SELECT id, slug FROM tenants WHERE slug = $1', [slug])
    if (rows.length === 0) {
      console.error(`No existe la empresa "${slug}". Verla con: node scripts/tenant.mjs listar`)
      process.exit(1)
    }
    return rows[0]
  }
  const { rows } = await pool.query('SELECT id, slug FROM tenants ORDER BY created_at')
  if (rows.length === 0) {
    console.error('No hay ninguna empresa creada. Crear una con: node scripts/tenant.mjs crear <slug> "<Nombre>"')
    process.exit(1)
  }
  if (rows.length > 1) {
    console.error(`Hay ${rows.length} empresas: indicar cuál con TENANT=<slug>.`)
    console.error(`  slugs: ${rows.map((r) => r.slug).join(', ')}`)
    process.exit(1)
  }
  return rows[0]
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
