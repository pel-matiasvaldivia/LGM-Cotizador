import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth-constants'

// Redirección rápida para páginas protegidas cuando no hay cookie de sesión.
// La validación real de la sesión (y del rol) ocurre en los layouts y en
// cada Route Handler vía requireUser() — esto es solo UX de redirect.
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const path = request.nextUrl.pathname

  const isDashboard = path.startsWith('/proyectos') || path.startsWith('/configuracion')
  const isClientPortal = path === '/mi-proyecto'

  if (isDashboard && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isClientPortal && !hasSession) {
    return NextResponse.redirect(new URL('/mi-proyecto/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/proyectos/:path*', '/configuracion/:path*', '/mi-proyecto'],
}
