import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { usuarios } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

const ROLES = ['admin', 'comercial', 'cliente'] as const
type Rol = (typeof ROLES)[number]

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Modifica datos y/o blanquea contraseña de un usuario.
export const PATCH = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireUser(['admin'])
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const target = await db.query.usuarios.findFirst({ where: eq(usuarios.id, id) })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const cambios: Partial<typeof usuarios.$inferInsert> = {}

  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim()
    if (!emailValido(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    const dup = await db.query.usuarios.findFirst({ where: and(eq(usuarios.email, email), ne(usuarios.id, id)) })
    if (dup) return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
    cambios.email = email
  }

  if (body.nombre !== undefined) cambios.nombre = String(body.nombre).trim()

  if (body.rol !== undefined) {
    const rol = String(body.rol) as Rol
    if (!ROLES.includes(rol)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    // No permitir que un admin se quite a sí mismo el rol admin (evita autobloqueo)
    if (id === actor.id && rol !== 'admin') {
      return NextResponse.json({ error: 'No podés quitarte tu propio rol de admin' }, { status: 400 })
    }
    cambios.rol = rol
  }

  if (body.password !== undefined && body.password !== '') {
    const password = String(body.password)
    if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    cambios.passwordHash = await hashPassword(password)
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const [user] = await db.update(usuarios).set(cambios).where(eq(usuarios.id, id)).returning()
  return NextResponse.json({
    usuario: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, created_at: user.createdAt.toISOString() },
  })
})

// Elimina un usuario (sus sesiones caen por ON DELETE CASCADE).
export const DELETE = withErrorHandling(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireUser(['admin'])
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  if (id === actor.id) return NextResponse.json({ error: 'No podés eliminar tu propia cuenta' }, { status: 400 })

  const [borrado] = await db.delete(usuarios).where(eq(usuarios.id, id)).returning({ id: usuarios.id })
  if (!borrado) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  return NextResponse.json({ success: true })
})
