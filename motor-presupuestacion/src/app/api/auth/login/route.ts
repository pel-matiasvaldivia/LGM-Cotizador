import { NextResponse } from 'next/server'
import { createSession, findUserByEmail } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'
import { withErrorHandling } from '@/lib/api-helpers'
import { exigirLimite, exigirLimitePorClave, LIMITES } from '@/lib/rate-limit'
import { estaVerificado } from '@/lib/verificacion'

export const POST = withErrorHandling(async (req: Request) => {
  const { email, password } = await req.json().catch(() => ({}))

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  // Dos frenos independientes: por IP (una máquina probando muchas cuentas) y
  // por cuenta sin mirar la IP (una botnet probando muchas contraseñas de la
  // misma cuenta desde direcciones distintas).
  exigirLimite(req, 'login', LIMITES.login)
  exigirLimitePorClave('login-cuenta', LIMITES.loginPorCuenta, String(email))

  const user = await findUserByEmail(email)
  // Verificar siempre contra un hash para no filtrar si el email existe
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, 'scrypt:00:00'), false)

  if (!user || !valid) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  await createSession(user.id)
  return NextResponse.json({
    success: true,
    rol: user.rol,
    nombre: user.nombre,
    verificado: estaVerificado(user),
  })
})
