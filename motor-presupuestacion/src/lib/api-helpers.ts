import { NextResponse } from 'next/server'
import { AuthError } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Postgres tira error de sintaxis ante un uuid inválido; validar antes de consultar.
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

// Envuelve un handler: convierte AuthError en 401/403 y cualquier otro error en 500.
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse | Response>,
) {
  return async (...args: T): Promise<NextResponse | Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      const message = error instanceof Error ? error.message : 'Error interno'
      console.error('[api]', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
