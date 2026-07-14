// Separado de auth.ts para que proxy.ts no arrastre la conexión a Postgres.
export const SESSION_COOKIE = 'lgm_session'
