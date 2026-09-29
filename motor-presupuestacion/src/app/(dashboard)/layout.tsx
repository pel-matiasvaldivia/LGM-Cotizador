import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'
import GestionUsuarios from '@/components/admin/GestionUsuarios'
import BrandLogo from '@/components/branding/BrandLogo'
import { getBrandActual } from '@/lib/tenant'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  // Un cliente autenticado no accede al panel interno: se lo envía a su portal
  // de seguimiento (evita el rebote /proyectos → /login → /proyectos).
  if (!['comercial', 'admin'].includes(user.rol)) {
    redirect('/mi-proyecto')
  }

  const displayName = user.nombre || user.email || 'Usuario'
  const brand = await getBrandActual()

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      <header className="bg-brand-ink text-white px-6 py-4 shadow-md flex items-center justify-between">
        <Link href="/proyectos" className="font-bold text-lg flex items-center gap-2">
          <BrandLogo brand={brand} variante="oscuro" alto={32} />
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/proyectos"
            className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Proyectos
          </Link>
          <Link
            href="/proyectos/nuevo"
            className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Nuevo
          </Link>
          <Link
            href="/configuracion/ratios"
            className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Ratios
          </Link>
          <Link
            href="/configuracion/parametros"
            className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Parámetros
          </Link>
          <Link
            href="/configuracion/precios"
            className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
          >
            Precios
          </Link>
          {user.rol === 'admin' && (
            <Link
              href="/configuracion/empresa"
              className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
            >
              Empresa
            </Link>
          )}
          {user.rol === 'admin' && (
            <Link
              href="/configuracion/importar"
              className="hover:text-brand transition-colors text-sm uppercase font-semibold tracking-wider"
            >
              Importar Base 0
            </Link>
          )}
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

      <main className="flex-1 w-full bg-brand-surface">
        {children}
      </main>
    </div>
  )
}
