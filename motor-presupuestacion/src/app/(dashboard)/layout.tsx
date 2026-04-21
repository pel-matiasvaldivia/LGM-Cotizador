import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .single()

  // Si la tabla perfiles no existe aún (migración pendiente), permitir acceso igual
  const rolValido = perfilError || !perfil
    ? true
    : ['comercial', 'admin'].includes(perfil.rol)

  if (!rolValido) {
    redirect('/login?error=sin_acceso')
  }

  const displayName = perfil?.nombre || user.email || 'Usuario'

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col">
      <header className="bg-[#1B2A47] text-white px-6 py-4 shadow-md flex items-center justify-between">
        <Link href="/proyectos" className="font-bold text-lg flex items-center gap-2">
          <img src="/logo.png" alt="Log Metal" className="h-8 w-auto" />
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/proyectos"
            className="hover:text-[#F05A28] transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Proyectos
          </Link>
          <Link
            href="/proyectos/nuevo"
            className="hover:text-[#F05A28] transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Nuevo
          </Link>
          <Link
            href="/configuracion/ratios"
            className="hover:text-[#F05A28] transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Configuración
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-slate-400 capitalize">{perfil?.rol ?? 'comercial'}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 w-full bg-[#F4F5F7]">
        {children}
      </main>
    </div>
  )
}
