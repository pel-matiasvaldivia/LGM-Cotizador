import { NextResponse } from 'next/server'
import { db } from '@/db'
import { usuarios } from '@/db/schema'
import { createSession, findUserByEmail } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { getTenant } from '@/lib/tenant'

// Registro público de clientes del portal (rol fijo 'cliente').
// Los usuarios comercial/admin se crean por seed o por un admin.
export async function POST(req: Request) {
  const { email, password, nombre } = await req.json().catch(() => ({}))

  // El cliente queda registrado en la empresa dueña del dominio por el que entró.
  const tenant = await getTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'Este dominio no está asignado a ninguna empresa' }, { status: 404 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    return NextResponse.json({ error: 'Este email ya tiene una cuenta', alreadyExists: true }, { status: 409 })
  }

  const [user] = await db.insert(usuarios).values({
    tenantId: tenant.id,
    email: String(email).toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    nombre: nombre ?? '',
    rol: 'cliente',
  }).returning()

  await createSession(user.id)
  return NextResponse.json({ success: true })
}
