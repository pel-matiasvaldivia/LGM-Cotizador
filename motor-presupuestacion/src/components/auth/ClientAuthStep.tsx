'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, Lock, Eye, EyeOff, UserPlus, LogIn, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Mode = 'register' | 'login'

export default function ClientAuthStep({
  email,
  nombre,
  onSuccess,
  submitting,
}: {
  email: string
  nombre: string
  onSuccess: () => void
  submitting: boolean
}) {
  const [mode, setMode] = useState<Mode>('register')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [existingEmail, setExistingEmail] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setExistingEmail(data.session.user.email)
      }
      setCheckingSession(false)
    })
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setExistingEmail(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    if (mode === 'register') {
      // Usar API server-side para crear usuario con email auto-confirmado
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.alreadyExists) {
          setMode('login')
          setError('Este email ya tiene una cuenta. Iniciá sesión.')
        } else {
          setError(data.error || 'Error al crear la cuenta.')
        }
        setLoading(false)
        return
      }

      // Cuenta creada y confirmada — iniciar sesión para obtener la sesión
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) {
        setError('Cuenta creada, pero no se pudo iniciar sesión. Intentá de nuevo.')
        setLoading(false)
        return
      }
    } else {
      let { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) {
        const msg = loginError.message.toLowerCase()
        if (msg.includes('confirm') || msg.includes('verified') || msg.includes('not confirmed')) {
          // Auto-confirmar si el email no fue confirmado y reintentar
          const confirmRes = await fetch('/api/auth/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          if (confirmRes.ok) {
            const retry = await supabase.auth.signInWithPassword({ email, password })
            loginError = retry.error ?? null
          }
        }
      }
      if (loginError) {
        setError('Contraseña incorrecta. Verificá tus datos.')
        setLoading(false)
        return
      }
    }

    onSuccess()
  }

  const inputClass =
    'w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] focus:border-transparent outline-none transition-shadow text-[#1B2A47] text-base'

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
      </div>
    )
  }

  // Ya hay sesión — pedir confirmación explícita, no auto-proceder
  if (existingEmail) {
    return (
      <div className="max-w-md mx-auto w-full">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-5 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#1B2A47] mb-0.5">Ya tenés una sesión activa</p>
            <p className="text-sm text-slate-500">{existingEmail}</p>
          </div>
        </div>

        <button
          onClick={onSuccess}
          disabled={submitting}
          className="w-full bg-[#F05A28] text-white py-4 rounded-xl font-bold text-base hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-orange-100 mb-3"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando solicitud...</>
            : 'Continuar con esta cuenta'}
        </button>

        <button
          onClick={handleSignOut}
          className="w-full text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors"
        >
          Usar otra cuenta
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto w-full">
      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
        {([
          { id: 'register' as Mode, label: 'Crear cuenta',    icon: <UserPlus className="w-4 h-4" /> },
          { id: 'login'    as Mode, label: 'Ya tengo cuenta', icon: <LogIn    className="w-4 h-4" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setMode(tab.id); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === tab.id
                ? 'bg-white text-[#1B2A47] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Email prefilled */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Email</label>
        <input
          type="email" value={email} readOnly
          className={`${inputClass} bg-slate-100 text-slate-500 cursor-default`}
        />
        <p className="text-xs text-slate-400 mt-1">Tomado de tus datos de contacto</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Contraseña</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mode === 'register' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Confirmar contraseña</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="Repetí tu contraseña"
                required
                autoComplete="new-password"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || submitting || !password}
          className="w-full bg-[#F05A28] text-white py-4 rounded-xl font-bold text-base hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-orange-100"
        >
          {loading || submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {submitting ? 'Enviando solicitud...' : 'Verificando...'}</>
          ) : mode === 'register' ? (
            'Crear cuenta y confirmar'
          ) : (
            'Iniciar sesión y confirmar'
          )}
        </button>
      </form>
    </div>
  )
}
