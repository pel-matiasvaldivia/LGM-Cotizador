'use client'

import { useState } from 'react'
import { CalendarCheck, CheckCircle2, Loader2, Video } from 'lucide-react'

// Acción del cliente para pre-aprobar la oferta. Al confirmar, el backend cambia
// el estado a 'preaprobado' y dispara la coordinación de la reunión (Google Meet).
export default function PreaprobarOferta({
  proyectoId,
  estado,
  reunionUrl,
}: {
  proyectoId: string
  estado: string
  reunionUrl?: string | null
}) {
  const yaPreaprobado = estado === 'preaprobado' || estado === 'aprobado'
  const [hecho, setHecho] = useState(yaPreaprobado)
  const [url, setUrl] = useState<string | null>(reunionUrl || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preaprobar = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proyectos/estado', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, estado: 'preaprobado' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'No se pudo pre-aprobar'); return }
      setUrl(data.reunionUrl || null)
      setHecho(true)
    } finally {
      setLoading(false)
    }
  }

  if (hecho) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 text-emerald-700 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          Oferta pre-aprobada
        </div>
        <p className="text-sm text-emerald-800/80 mt-1">
          Tu asesor comercial se pondrá en contacto para confirmar la reunión. También podés agendarla por Google Meet.
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-3 bg-[#1B2A47] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
          >
            <Video className="w-4 h-4" />
            Agendar reunión (Google Meet)
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-xl border border-gray-200 bg-slate-50 p-5">
      <p className="font-bold text-[#1B2A47]">¿Avanzamos con tu proyecto?</p>
      <p className="text-sm text-slate-500 mt-1 mb-3">
        Pre-aprobá la oferta y coordinamos una reunión con tu asesor comercial por Google Meet.
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button
        onClick={preaprobar}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-[#F05A28] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
        Pre-aprobar la oferta
      </button>
    </div>
  )
}
