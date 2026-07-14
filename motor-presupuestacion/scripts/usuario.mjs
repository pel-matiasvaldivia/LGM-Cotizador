// Crea o resetea un usuario de staff (admin / comercial) o cualquier rol.
// Útil porque el registro público solo crea rol 'cliente' y el seed inicial
// solo corre con la tabla vacía.
//
// Uso (dentro del contenedor app):
//   docker compose exec app node scripts/usuario.mjs <email> <password> [rol] [nombre]
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

  const { rowCount } = await pool.query(
    `UPDATE usuarios SET password_hash = $2, rol = $3, nombre = $4 WHERE email = $1`,
    [email, hashPassword(password), rol, nombre]
  )

  if (rowCount > 0) {
    console.log(`✓ Usuario actualizado: ${email} (rol: ${rol})`)
  } else {
    await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES ($1, $2, $3, $4)`,
      [email, hashPassword(password), nombre, rol]
    )
    console.log(`✓ Usuario creado: ${email} (rol: ${rol})`)
  }

  await pool.end()
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
