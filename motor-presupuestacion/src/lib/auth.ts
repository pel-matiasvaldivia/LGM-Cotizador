import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { sesiones, usuarios, type Usuario } from '@/db/schema'
import { SESSION_COOKIE } from '@/lib/auth-constants'

export { SESSION_COOKIE }
const SESSION_DAYS = 30

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

// Crea la sesión en DB y setea la cookie. Llamar solo desde Route Handlers / Server Actions.
export async function createSession(usuarioId: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(sesiones).values({ tokenHash: sha256(token), usuarioId, expiresAt })
  // Limpieza oportunista de sesiones vencidas
  await db.delete(sesiones).where(lt(sesiones.expiresAt, new Date()))

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await db.delete(sesiones).where(eq(sesiones.tokenHash, sha256(token)))
  }
  cookieStore.delete(SESSION_COOKIE)
}

// Devuelve el usuario autenticado o null. Seguro de usar en Server Components.
export async function getCurrentUser(): Promise<Usuario | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.query.sesiones.findFirst({
    where: eq(sesiones.tokenHash, sha256(token)),
    with: { usuario: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.usuario
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Para Route Handlers: lanza AuthError si no hay sesión o el rol no alcanza.
export async function requireUser(roles?: Array<Usuario['rol']>): Promise<Usuario> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('No autenticado', 401)
  if (roles && !roles.includes(user.rol)) throw new AuthError('Sin permisos', 403)
  return user
}

export async function findUserByEmail(email: string) {
  return db.query.usuarios.findFirst({ where: eq(usuarios.email, email.toLowerCase().trim()) })
}
