import LoginForm from '@/components/auth/LoginForm'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BrandLogo from '@/components/branding/BrandLogo'
import DominioNoConfigurado from '@/components/branding/DominioNoConfigurado'
import { getBrandActual, getTenant } from '@/lib/tenant'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const tenant = await getTenant()
  if (!tenant) return <DominioNoConfigurado />

  const user = await getCurrentUser()
  const brand = await getBrandActual()

  if (user) {
    // Los clientes van a su portal de seguimiento; el equipo interno, al panel.
    redirect(user.rol === 'cliente' ? '/mi-proyecto' : (params.next || '/proyectos'))
  }

  return (
    <div className="min-h-screen bg-brand-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo + título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandLogo brand={brand} alto={56} />
          </div>
          <h1 className="text-2xl font-bold text-brand-ink">Portal Comercial</h1>
          <p className="text-slate-500 text-sm mt-1">Acceso exclusivo para el equipo de {brand.nombre}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <LoginForm nextUrl={params.next} />
        </div>

        <div className="text-center mt-6 space-y-2">
          <Link
            href="/"
            className="inline-block text-sm font-semibold text-slate-500 hover:text-brand-ink transition-colors"
          >
            ← Volver al inicio
          </Link>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {brand.razonSocial}
            {brand.footerNota && ` · ${brand.footerNota}`}
          </p>
        </div>
      </div>
    </div>
  )
}
