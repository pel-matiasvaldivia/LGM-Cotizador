'use client'

import { useState } from 'react'
import { FileSignature, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

// Firma del contrato desde el portal del cliente.
//
// La firma vale por la cuenta: para llegar hasta acá el cliente entró con su
// email confirmado, y eso queda registrado junto con la fecha y una huella del
// origen. No es una firma digital con certificado — es una aceptación
// electrónica trazable, que es lo que esta instancia del proceso necesita.

export default function FirmarContrato({
  proyectoId,
  numero,
  montoTotalUsd,
  plazoEntregaDias,
  firmadoAt,
  firmadoPor,
  nombreSugerido,
}: {
  proyectoId: string
  numero: string
  montoTotalUsd: number
  plazoEntregaDias: number
  firmadoAt: string | null
  firmadoPor: string
  nombreSugerido: string
}) {
  const [firmado, setFirmado] = useState(Boolean(firmadoAt))
  const [quien, setQuien] = useState(firmadoPor || nombreSugerido)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pdf = `/api/proyectos/contrato?proyectoId=${proyectoId}`

  const firmar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/proyectos/contrato', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, nombre: quien, aceptaCondiciones: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la firma')
      setFirmado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al firmar')
    } finally {
      setEnviando(false)
    }
  }

  if (firmado) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-brand-ink">Contrato firmado</h2>
            <p className="text-sm text-slate-500 mt-1">
              Firmaste el contrato <strong>{numero}</strong>. Nuestra oficina técnica ya arrancó con
              tu proyecto: el plazo comprometido es de {plazoEntregaDias} días corridos.
            </p>
            <a
              href={pdf}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-brand font-semibold text-sm hover:underline"
            >
              <Download className="w-4 h-4" /> Descargar el contrato firmado
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-brand-line shadow-sm p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 bg-brand-soft rounded-xl flex items-center justify-center">
          <FileSignature className="w-6 h-6 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-brand-ink">Tu contrato está listo para firmar</h2>
          <p className="text-sm text-slate-500">
            Contrato {numero} · {plazoEntregaDias} días corridos de plazo
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-4">
        Recoge el alcance y los importes del presupuesto que aprobaste, por un total de{' '}
        <strong className="text-brand-ink">
          USD {Number(montoTotalUsd || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </strong>
        . Leelo completo antes de firmar.
      </p>

      <a
        href={pdf}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 bg-white text-brand-ink border border-gray-200 px-5 py-2.5 rounded-xl font-bold text-sm hover:border-brand-ink transition-all mb-6"
      >
        <Download className="w-4 h-4" /> Leer el contrato (PDF)
      </a>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-5 border border-gray-100">
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Nombre y apellido de quien firma
        </label>
        <input
          type="text"
          value={quien}
          onChange={(e) => setQuien(e.target.value)}
          className="block w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-brand-ink focus:ring-2 focus:ring-brand focus:border-transparent outline-none mb-4"
        />

        <label className="flex items-start gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 accent-brand cursor-pointer"
          />
          <span className="text-sm text-slate-600">
            Leí el contrato y acepto sus condiciones: alcance, precio, forma de pago y plazo de
            entrega. Firmo electrónicamente desde mi cuenta.
          </span>
        </label>

        <button
          onClick={firmar}
          disabled={!acepta || !quien.trim() || enviando}
          className="flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-brand-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-brand-line"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
          Firmar el contrato
        </button>

        <p className="text-xs text-slate-400 mt-3">
          Queda registrada la fecha, la hora y la cuenta desde la que firmás. Si preferís firmarlo en
          papel, avisale a tu asesor comercial.
        </p>
      </div>
    </div>
  )
}
