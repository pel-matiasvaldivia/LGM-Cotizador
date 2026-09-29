// Tipos del módulo compartido de semilla (scripts/lib/semilla.mjs). El módulo
// está en JS plano porque también lo importan los scripts de operaciones, que
// corren con `node` sobre la imagen standalone; estas declaraciones son para que
// el lado TypeScript lo use con tipos de verdad.

/** Resultado de una consulta, con la forma que devuelve `pg`. */
export interface ResultadoQuery {
  rows: Array<Record<string, unknown>>
  rowCount?: number | null
}

/** Ejecutor de SQL sobre UNA conexión (quien llama maneja la transacción). */
export type Query = (text: string, params?: unknown[]) => Promise<ResultadoQuery>

export interface PoolMinimo {
  connect(): Promise<{
    query: (text: string, params?: unknown[]) => Promise<ResultadoQuery>
    release: () => void
  }>
}

export interface ResultadoSemilla {
  /** Claves de configuración insertadas (las que faltaban). */
  parametros: number
  rubrosCopiados: number
  /** Slug de la empresa usada como plantilla, o null si no se copió nada. */
  plantilla: string | null
  yaTeniaCatalogo: boolean
}

/** Variables de entorno, con la forma mínima que usa la semilla. */
export type Entorno = Record<string, string | undefined>

export interface OpcionesSemilla {
  plantillaId?: string
  env?: Entorno
}

export function parametrosIniciales(env?: Entorno): Record<string, unknown>

export function sembrarParametros(query: Query, tenantId: string, env?: Entorno): Promise<number>

export function copiarCatalogo(query: Query, origenId: string, destinoId: string): Promise<number>

export function sembrarEmpresa(
  query: Query,
  tenantId: string,
  opciones?: OpcionesSemilla,
): Promise<ResultadoSemilla>

export function enTransaccion<T>(pool: PoolMinimo, fn: (query: Query) => Promise<T>): Promise<T>
