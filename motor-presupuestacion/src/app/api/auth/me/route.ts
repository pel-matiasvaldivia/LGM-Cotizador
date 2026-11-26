import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { estaVerificado } from '@/lib/verificacion'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      // El wizard lo usa para avisar que falta confirmar el email antes de que
      // el cliente se vaya de la pantalla.
      verificado: estaVerificado(user),
    },
  })
}
