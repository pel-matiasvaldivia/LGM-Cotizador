'use client'

import { useState } from 'react'
import { MailCheck, Loader2 } from 'lucide-react'
import type { Brand } from '@/lib/branding'
import BrandLogo from '@/components/branding/BrandLogo'
import LogoutButton from '@/components/auth/LogoutButton'

// Pantalla del portal mientras la cuenta no confirmó su email. No muestra nada
// del proyecto: es justamente el dato que no se puede exponer sin saber que el
// email es de quien dice ser.
export default function VerificacionPendiente({
  brand,
  email,
  resultado,
}: {
  brand: Brand
  email: string
  /** Vuelta del link del mail: 1 si el token sirvió, 0 si venció o ya se usó. */
  resultado?: 'ok' | 'invalido'
}) {
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reenviar() {
    setEnviando(true)
    setMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/auth/verificar', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || 'No se pudo reenviar')
      setMsg(`Te reenviamos el correo a ${email}. Puede tardar un par de minutos.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo brand={brand} alto={40} />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">{email}</span>
            <LogoutButton redirectTo="/mi-proyecto/login" />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-brand-soft rounded-2xl flex items-center justify-center mx-auto mb-5">
            <MailCheck className="w-7 h-7 text-brand" />
          </div>

          <h1 className="text-2xl font-bold text-brand-ink mb-2">Confirmá tu email</h1>

          {resultado === 'invalido' && (
            <p className="text-sm rounded-lg px-4 py-2.5 bg-amber-50 text-amber-800 mb-4">
              Ese enlace ya se usó o venció. Pedí uno nuevo con el botón de abajo.
            </p>
          )}

          <p className="text-slate-500 leading-relaxed mb-6">
            Te mandamos un correo a <strong className="text-brand-ink">{email}</strong>. Abrilo y
            seguí el enlace para ver el estado de tu proyecto y descargar tu presupuesto.
          </p>

          <p className="text-xs text-slate-400 mb-6">
            Pedimos este paso para asegurarnos de que el presupuesto lo vea sólo su destinatario.
          </p>

          {msg && <div className="text-sm rounded-lg px-4 py-2.5 bg-emerald-50 text-emerald-700 mb-4">{msg}</div>}
          {error && <div className="text-sm rounded-lg px-4 py-2.5 bg-red-50 text-red-700 mb-4">{error}</div>}

          <button
            onClick={reenviar}
            disabled={enviando}
            className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-hover disabled:opacity-40"
          >
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            Reenviar el correo
          </button>

          <p className="text-xs text-slate-400 mt-6">
            ¿No te llega? Revisá el correo no deseado
            {brand.contacto.email ? <> o escribinos a <strong>{brand.contacto.email}</strong></> : null}.
          </p>
        </div>
      </main>
    </div>
  )
}
