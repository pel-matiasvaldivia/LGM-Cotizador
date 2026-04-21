import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClientLoginForm from './ClientLoginForm'

export default async function MiProyectoLoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/mi-proyecto')
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Log Metal" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#1B2A47]">Seguimiento de proyecto</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ingresá con tu cuenta para ver el estado de tu proyecto
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <ClientLoginForm />
        </div>

        <div className="text-center mt-6 space-y-2">
          <Link
            href="/"
            className="inline-block text-sm font-semibold text-slate-500 hover:text-[#1B2A47] transition-colors"
          >
            ← Volver al inicio
          </Link>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Log Metal SRL · Mendoza, Argentina
          </p>
        </div>
      </div>
    </div>
  )
}
