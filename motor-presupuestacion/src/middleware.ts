import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar sesión (IMPORTANTE: no llamar a getSession aquí, usar getUser)
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isDashboard =
    path.startsWith('/proyectos') || path.startsWith('/configuracion')
  const isClientPortal = path === '/mi-proyecto'

  if (isDashboard && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  if (isClientPortal && !user) {
    return NextResponse.redirect(new URL('/mi-proyecto/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/proyectos/:path*',
    '/configuracion/:path*',
    '/mi-proyecto',
  ],
}
