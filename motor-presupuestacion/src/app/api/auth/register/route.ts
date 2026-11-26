import { NextResponse } from 'next/server'
import { db } from '@/db'
import { usuarios } from '@/db/schema'
import { createSession, findUserByEmail } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { getTenant } from '@/lib/tenant'
import { withErrorHandling } from '@/lib/api-helpers'
import { exigirLimite, LIMITES } from '@/lib/rate-limit'
import { generarToken, linkVerificacion } from '@/lib/verificacion'
import { enviarVerificacionEmail } from '@/lib/notificaciones'
import { brandDesdeTenant } from '@/lib/branding'
import { appUrl, emailConfigurado } from '@/lib/email'

// Registro público de clientes del portal (rol fijo 'cliente').
// Los usuarios comercial/admin se crean por seed o por un admin.
export const POST = withErrorHandling(async (req: Request) => {
  exigirLimite(req, 'registro', LIMITES.registro)

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

  // La cuenta queda creada y con sesión, pero sin ver presupuestos hasta
  // confirmar el email (ver src/lib/verificacion.ts). El mail se manda acá.
  const token = await generarToken(user.id)
  const envio = await enviarVerificacionEmail(
    user.email,
    user.nombre,
    linkVerificacion(appUrl(), token),
    brandDesdeTenant(tenant),
  )

  return NextResponse.json({
    success: true,
    verificacionPendiente: true,
    // Si el correo no está configurado en el despliegue, el enlace queda en el
    // log del servidor: el admin puede pasárselo al cliente mientras tanto.
    emailEnviado: envio.sent,
    avisoEmail: envio.sent
      ? undefined
      : emailConfigurado()
        ? 'No pudimos enviar el mail de confirmación. Pedí que te lo reenvíen.'
        : 'El envío de correo no está configurado: pedile el enlace de confirmación al equipo.',
  })
})
