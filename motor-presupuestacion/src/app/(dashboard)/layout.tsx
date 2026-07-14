import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'
import GestionUsuarios from '@/components/admin/GestionUsuarios'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (!['comercial', 'admin'].includes(user.rol)) {
    redirect('/login?error=sin_acceso')
  }

  const displayName = user.nombre || user.email || 'Usuario'

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
          {user.rol === 'admin' && <GestionUsuarios currentUserId={user.id} />}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold leading-tight">{displayName}</p>
            <p className="text-xs text-slate-400 capitalize">{user.rol}</p>
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
