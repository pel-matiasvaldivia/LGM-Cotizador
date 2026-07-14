import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { usuarios } from '@/db/schema'
import { requireUser, findUserByEmail } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { withErrorHandling } from '@/lib/api-helpers'

const ROLES = ['admin', 'comercial', 'cliente'] as const
type Rol = (typeof ROLES)[number]

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Lista todos los usuarios (staff + clientes). Nunca expone el hash.
export const GET = withErrorHandling(async () => {
  await requireUser(['admin'])
  const filas = await db.query.usuarios.findMany({ orderBy: asc(usuarios.createdAt) })
  return NextResponse.json({
    usuarios: filas.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      created_at: u.createdAt.toISOString(),
    })),
  })
})

// Crea un usuario nuevo con cualquier rol.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['admin'])
  const body = await req.json().catch(() => ({}))

  const email = String(body.email || '').toLowerCase().trim()
  const nombre = String(body.nombre || '').trim()
  const password = String(body.password || '')
  const rol = String(body.rol || 'comercial') as Rol

  if (!emailValido(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (!ROLES.includes(rol)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })

  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
  }

  const [user] = await db
    .insert(usuarios)
    .values({ email, nombre: nombre || 'Usuario', rol, passwordHash: await hashPassword(password) })
    .returning()

  return NextResponse.json({
    usuario: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, created_at: user.createdAt.toISOString() },
  })
})
