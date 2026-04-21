'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, Lock, Mail, Eye, EyeOff } from 'lucide-react'

export default function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Credenciales incorrectas. Verificá tu email y contraseña.')
      setLoading(false)
      return
    }

    // Redirigir — el loading se mantiene hasta que la página nueva cargue
    router.push(nextUrl || '/proyectos')
    router.refresh()
    // Timeout de seguridad por si la navegación no completa
    setTimeout(() => setLoading(false), 4000)
  }

  const inputClass =
    'w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] focus:border-transparent outline-none transition-shadow text-[#1B2A47] text-sm'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-2">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="comercial@logmetal.com"
            required
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-2">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-11`}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full bg-[#F05A28] text-white py-3.5 rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-orange-200"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ingresando...
          </>
        ) : (
          'Ingresar al portal'
        )}
      </button>
    </form>
  )
}
