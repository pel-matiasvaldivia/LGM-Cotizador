// Verificación del email de las cuentas del portal.
//
// El portal muestra los presupuestos cuyo email coincide con el de la cuenta, y
// registrarse es público: sin esta confirmación, cualquiera podía ver la
// cotización de otro registrándose con su email. Una cuenta de cliente no ve
// nada hasta confirmar.
//
// El staff (admin/comercial) no pasa por acá: lo crea alguien de adentro.

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { usuarios, type Usuario } from '@/db/schema'
import { AuthError } from '@/lib/errors'

const VIGENCIA_HORAS = 48

function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

/** ¿Esta cuenta puede ver los datos del portal? */
export function estaVerificado(user: Usuario): boolean {
  // Sólo se le exige al cliente: el staff lo dio de alta un admin.
  if (user.rol !== 'cliente') return true
  return user.emailVerificadoAt !== null
}

/**
 * Genera un token nuevo y lo guarda hasheado (como las sesiones: en claro sólo
 * viaja al mail del dueño de la casilla). Devuelve el token en claro para armar
 * el link.
 */
export async function generarToken(usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expira = new Date(Date.now() + VIGENCIA_HORAS * 60 * 60 * 1000)

  await db
    .update(usuarios)
    .set({ verificacionTokenHash: sha256(token), verificacionExpira: expira })
    .where(eq(usuarios.id, usuarioId))

  return token
}

/** Link que se manda por mail. */
export function linkVerificacion(appUrl: string, token: string): string {
  return `${appUrl}/api/auth/verificar?token=${token}`
}

/**
 * Consume un token: marca el email como verificado y lo invalida. Devuelve el
 * usuario verificado, o null si el token no sirve (inexistente o vencido).
 */
export async function verificarConToken(token: string): Promise<Usuario | null> {
  if (!token || token.length < 32) return null

  const user = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.verificacionTokenHash, sha256(token)),
      gt(usuarios.verificacionExpira, new Date()),
    ),
  })
  if (!user) return null

  const [actualizado] = await db
    .update(usuarios)
    .set({
      emailVerificadoAt: new Date(),
      verificacionTokenHash: null,
      verificacionExpira: null,
    })
    .where(eq(usuarios.id, user.id))
    .returning()

  return actualizado
}

/** Corta con 403 si la cuenta todavía no confirmó su email. */
export function exigirVerificado(user: Usuario): void {
  if (!estaVerificado(user)) {
    throw new AuthError('Confirmá tu email para ver el proyecto', 403)
  }
}
