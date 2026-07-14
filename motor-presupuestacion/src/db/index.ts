import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

type Db = NodePgDatabase<typeof schema>

// Pool único por proceso (en dev, sobrevive a los hot-reloads vía globalThis)
const globalForDb = globalThis as unknown as { __lgmDb?: Db }

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada')
  }
  return drizzle(new Pool({ connectionString, max: 10 }), { schema })
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
