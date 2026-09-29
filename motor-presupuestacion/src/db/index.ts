import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

type Db = NodePgDatabase<typeof schema>

// Pool único por proceso (en dev, sobrevive a los hot-reloads vía globalThis)
const globalForDb = globalThis as unknown as { __lgmDb?: Db; __lgmPool?: Pool }

function crearPool(): Pool {
  // Preferir variables discretas (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT):
  // evitan el problema de contraseñas con caracteres especiales dentro de la URL.
  if (process.env.PGHOST) return new Pool({ max: 10 })

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Configurar PGHOST/PGUSER/PGPASSWORD/PGDATABASE (o DATABASE_URL)')
  }
  return new Pool({ connectionString, max: 10 })
}

/**
 * Pool de `pg` que usa drizzle por debajo. Sirve para lo poco que se hace con
 * SQL plano: la semilla de una empresa comparte su implementación con
 * scripts/tenant.mjs (ver scripts/lib/semilla.mjs), que no puede usar drizzle.
 */
export function getPool(): Pool {
  if (!globalForDb.__lgmPool) globalForDb.__lgmPool = crearPool()
  return globalForDb.__lgmPool
}

function createDb(): Db {
  return drizzle(getPool(), { schema })
}

// Inicialización perezosa: la conexión recién se crea en el primer uso,
// así importar módulos que usan `db` (tests, build) no exige DATABASE_URL.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!globalForDb.__lgmDb) globalForDb.__lgmDb = createDb()
    const value = globalForDb.__lgmDb[prop as keyof Db]
    return typeof value === 'function' ? value.bind(globalForDb.__lgmDb) : value
  },
})

export { schema }
