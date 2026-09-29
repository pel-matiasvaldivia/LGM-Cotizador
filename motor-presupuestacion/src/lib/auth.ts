import { createHash, randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { and, eq, lt } from 'drizzle-orm'
import { db } from '@/db'
import { sesiones, usuarios, type Usuario } from '@/db/schema'
import { SESSION_COOKIE } from '@/lib/auth-constants'
import { AuthError } from '@/lib/errors'
import { getTenant } from '@/lib/tenant'

export { SESSION_COOKIE }
export { AuthError }
const SESSION_DAYS = 30

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

// La cookie solo debe marcarse Secure si realmente se sirve por HTTPS; de lo
// contrario el navegador la descarta y la sesión nunca persiste. Se puede
// forzar con COOKIE_SECURE=true|false; si no, se detecta por X-Forwarded-Proto.
async function cookieSecure(): Promise<boolean> {
  const override = process.env.COOKIE_SECURE
  if (override === 'true') return true
  if (override === 'false') return false
  const proto = (await headers()).get('x-forwarded-proto')
  return proto === 'https'
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
    secure: await cookieSecure(),
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
//
// Multi-tenant: una sesión sólo vale en el dominio de la empresa del usuario.
// Si la cookie llega por otro dominio, es como no estar logueado — así una
// sesión no se puede reutilizar para entrar a los datos de otra empresa.
export async function getCurrentUser(): Promise<Usuario | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.query.sesiones.findFirst({
    where: eq(sesiones.tokenHash, sha256(token)),
    with: { usuario: true },
  })
  if (!session || session.expiresAt < new Date()) return null

  const tenant = await getTenant()
  if (!tenant || session.usuario.tenantId !== tenant.id) return null

  return session.usuario
}

// Para Route Handlers: lanza AuthError si no hay sesión o el rol no alcanza.
export async function requireUser(roles?: Array<Usuario['rol']>): Promise<Usuario> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('No autenticado', 401)
  if (roles && !roles.includes(user.rol)) throw new AuthError('Sin permisos', 403)
  return user
}

// Busca por email DENTRO de la empresa del dominio: el mismo email puede ser
// cliente de una empresa y comercial de otra.
// Para las rutas de plataforma (/api/admin/*): además de estar autenticado, el
// usuario tiene que ser superadmin. El 404 en lugar de 403 es deliberado: para
// un admin de empresa, la administración de la plataforma no existe.
export async function requireSuperadmin(): Promise<Usuario> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('No autenticado', 401)
  if (!user.superadmin) throw new AuthError('No encontrado', 404)
  return user
}

export async function findUserByEmail(email: string) {
  const tenant = await getTenant()
  if (!tenant) return undefined
  return db.query.usuarios.findFirst({
    where: and(eq(usuarios.tenantId, tenant.id), eq(usuarios.email, email.toLowerCase().trim())),
  })
}
