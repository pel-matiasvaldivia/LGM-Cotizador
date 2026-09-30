import { NextResponse } from 'next/server'
import { appUrl, emailConfigurado } from '@/lib/email'
import { withErrorHandling } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/auth'
import { brandDesdeTenant } from '@/lib/branding'
import { enviarVerificacionEmail } from '@/lib/notificaciones'
import { exigirLimite, LIMITES } from '@/lib/rate-limit'
import { getTenant } from '@/lib/tenant'
import { estaVerificado, generarToken, linkVerificacion, verificarConToken } from '@/lib/verificacion'

// GET: el link que llega por mail. Consume el token y manda al portal.
export const GET = withErrorHandling(async (req: Request) => {
  const token = new URL(req.url).searchParams.get('token') || ''
  const user = await verificarConToken(token)

  // Se responde con una redirección en los dos casos: el resultado se le
  // muestra al cliente en el portal, que es donde está mirando.
  const destino = user ? '/mi-proyecto?verificado=1' : '/mi-proyecto?verificado=0'
  return NextResponse.redirect(new URL(destino, appUrl()))
})

// POST: reenviar la confirmación a la cuenta que está logueada.
export const POST = withErrorHandling(async (req: Request) => {
  exigirLimite(req, 'verificacion', LIMITES.verificacion)

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (estaVerificado(user)) return NextResponse.json({ success: true, yaVerificado: true })

  const token = await generarToken(user.id)
  const envio = await enviarVerificacionEmail(
    user.email,
    user.nombre,
    linkVerificacion(appUrl(), token),
    brandDesdeTenant(await getTenant()),
  )

  return NextResponse.json({
    success: envio.sent,
    error: envio.sent
      ? undefined
      : emailConfigurado()
        ? 'No pudimos enviar el mail. Probá de nuevo en unos minutos.'
        : 'El envío de correo no está configurado en este sitio. Pedile el enlace al equipo comercial.',
  })
})
