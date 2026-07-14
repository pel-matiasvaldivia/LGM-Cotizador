import { NextResponse } from 'next/server'
import { db } from '@/db'
import { usuarios } from '@/db/schema'
import { createSession, findUserByEmail } from '@/lib/auth'
import { hashPassword } from '@/lib/password'

// Registro público de clientes del portal (rol fijo 'cliente').
// Los usuarios comercial/admin se crean por seed o por un admin.
export async function POST(req: Request) {
  const { email, password, nombre } = await req.json().catch(() => ({}))

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
    email: String(email).toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    nombre: nombre ?? '',
    rol: 'cliente',
  }).returning()

  await createSession(user.id)
  return NextResponse.json({ success: true })
}
