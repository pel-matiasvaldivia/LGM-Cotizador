'use client'

import { useRef, useState } from 'react'
import {
  FileSignature, Factory, Loader2, Download, Check, Clock, Upload, AlertCircle, PenLine,
} from 'lucide-react'

// Cierre de la venta, del lado del comercial. Es lo que pasa después de la
// reunión con el cliente, en tres pasos encadenados:
//
//   1. Cerrar la venta → se emite el contrato con lo acordado.
//   2. El contrato se firma (el cliente desde su portal, o en papel).
//   3. Con el contrato firmado se emite la orden de producción.
//
// Cada paso se habilita sólo cuando el anterior está hecho: el backend lo
// exige igual, acá se ve por qué.

export type ContratoRow = {
  id: string
  numero: string
  plazo_entrega_dias: number
  fecha_inicio: string
  anticipo_pct: number
  forma_pago: string
  lugar_entrega: string
  garantia_meses: number
  observaciones: string
  monto_sin_iva_usd: number
  iva_usd: number
  monto_total_usd: number
  firmado_at: string | null
  firmado_por: string
  firmado_email: string
  firma_metodo: 'digital' | 'manual' | null
  created_at: string
}

export type OrdenRow = {
  id: string
  numero: string
  fecha_entrega_comprometida: string
  prioridad: string
  estado: string
  notas_taller: string
  created_at: string
}

const input =
  'block w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-brand-ink focus:ring-2 focus:ring-brand focus:border-transparent outline-none'
const label = 'block text-xs font-semibold text-slate-500 mb-1'

function usd(n: number) {
  return 'USD ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fecha(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function Paso({ n, titulo, estado, children }: {
  n: number
  titulo: string
  estado: 'hecho' | 'activo' | 'pendiente'
  children?: React.ReactNode
}) {
  const circulo =
    estado === 'hecho' ? 'bg-emerald-500 text-white'
      : estado === 'activo' ? 'bg-brand text-white'
      : 'bg-slate-200 text-slate-500'

  return (
    <div className={`flex gap-4 ${estado === 'pendiente' ? 'opacity-50' : ''}`}>
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${circulo}`}>
          {estado === 'hecho' ? <Check className="w-4 h-4" /> : n}
        </div>
        {n < 3 && <div className="w-px flex-1 bg-slate-200 my-1" />}
      </div>
      <div className="flex-1 pb-6">
        <p className="font-bold text-brand-ink mb-2">{titulo}</p>
        {children}
      </div>
    </div>
  )
}

export default function CierreVenta({
  proyectoId,
  estado,
  contrato: contratoInicial,
  orden: ordenInicial,
  ubicacionObra,
  onEstado,
}: {
  proyectoId: string
  estado: string
  contrato: ContratoRow | null
  orden: OrdenRow | null
  ubicacionObra: string
  onEstado: (estado: string) => void
}) {
  const [contrato, setContrato] = useState<ContratoRow | null>(contratoInicial)
  const [orden, setOrden] = useState<OrdenRow | null>(ordenInicial)
  const [error, setError] = useState<string | null>(null)

  const [abrirForm, setAbrirForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cond, setCond] = useState({
    plazoEntregaDias: String(contratoInicial?.plazo_entrega_dias || 90),
    fechaInicio: contratoInicial?.fecha_inicio || '',
    anticipoPct: String(contratoInicial?.anticipo_pct ?? 30),
    formaPago: contratoInicial?.forma_pago || '30% anticipo, 70% contra avance de obra',
    lugarEntrega: contratoInicial?.lugar_entrega || ubicacionObra || '',
    garantiaMeses: String(contratoInicial?.garantia_meses || 12),
    observaciones: contratoInicial?.observaciones || '',
  })

  const [subiendo, setSubiendo] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)

  const [emitiendoOrden, setEmitiendoOrden] = useState(false)
  const [datosOrden, setDatosOrden] = useState({ prioridad: 'normal', notasTaller: '' })

  const firmado = Boolean(contrato?.firmado_at)

  const emitirContrato = async () => {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/proyectos/contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId,
          plazoEntregaDias: Number(cond.plazoEntregaDias) || 0,
          fechaInicio: cond.fechaInicio,
          anticipoPct: Number(cond.anticipoPct) || 0,
          formaPago: cond.formaPago,
          lugarEntrega: cond.lugarEntrega,
          garantiaMeses: Number(cond.garantiaMeses) || 0,
          observaciones: cond.observaciones,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo emitir el contrato')
      setContrato(data.contrato)
      setAbrirForm(false)
      onEstado('contrato')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al emitir el contrato')
    } finally {
      setGuardando(false)
    }
  }

  const subirFirmado = async (file: File) => {
    setSubiendo(true)
    setError(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/proyectos/contrato', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId,
          archivo: { nombre: file.name, tipoMime: file.type, base64 },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la firma')
      setContrato(data.contrato)
      onEstado('aprobado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la firma')
    } finally {
      setSubiendo(false)
      if (archivoRef.current) archivoRef.current.value = ''
    }
  }

  const emitirOrden = async () => {
    setEmitiendoOrden(true)
    setError(null)
    try {
      const res = await fetch('/api/proyectos/orden-produccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, ...datosOrden }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo emitir la orden')
      setOrden(data.orden)
      onEstado('produccion')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al emitir la orden')
    } finally {
      setEmitiendoOrden(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <FileSignature className="w-4 h-4 text-slate-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cierre de la venta</h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Lo que se acuerda en la reunión con el cliente: contrato, firma y arranque de oficina técnica.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Paso 1: cerrar la venta ───────────────────────────── */}
      <Paso n={1} titulo="Cerrar la venta y emitir el contrato" estado={contrato ? 'hecho' : 'activo'}>
        {!contrato && !abrirForm && (
          <>
            <p className="text-sm text-slate-500 mb-3">
              {estado === 'preaprobado'
                ? 'El cliente pre-aprobó la oferta. Cargá lo que acordaron en la reunión y se emite el contrato.'
                : 'Cargá las condiciones acordadas con el cliente y se emite el contrato sobre el presupuesto actual.'}
            </p>
            <button
              onClick={() => setAbrirForm(true)}
              className="flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-hover transition-all shadow-md shadow-brand-line"
            >
              <FileSignature className="w-4 h-4" /> Cerrar la venta
            </button>
          </>
        )}

        {abrirForm && (
          <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={label}>Plazo de entrega (días corridos) *</label>
                <input type="number" min="1" className={input} value={cond.plazoEntregaDias}
                       onChange={(e) => setCond({ ...cond, plazoEntregaDias: e.target.value })} />
              </div>
              <div>
                <label className={label}>Inicio previsto</label>
                <input type="date" className={input} value={cond.fechaInicio}
                       onChange={(e) => setCond({ ...cond, fechaInicio: e.target.value })} />
              </div>
              <div>
                <label className={label}>Anticipo (%)</label>
                <input type="number" min="0" max="100" className={input} value={cond.anticipoPct}
                       onChange={(e) => setCond({ ...cond, anticipoPct: e.target.value })} />
              </div>
              <div>
                <label className={label}>Garantía (meses)</label>
                <input type="number" min="0" className={input} value={cond.garantiaMeses}
                       onChange={(e) => setCond({ ...cond, garantiaMeses: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Forma de pago</label>
                <input type="text" className={input} value={cond.formaPago}
                       onChange={(e) => setCond({ ...cond, formaPago: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Lugar de entrega</label>
                <input type="text" className={input} value={cond.lugarEntrega}
                       placeholder="Dirección de la obra"
                       onChange={(e) => setCond({ ...cond, lugarEntrega: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={label}>Condiciones particulares</label>
                <textarea rows={3} className={`${input} resize-y`} value={cond.observaciones}
                          placeholder="Lo que se haya acordado y no esté en las cláusulas generales."
                          onChange={(e) => setCond({ ...cond, observaciones: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              El contrato congela el presupuesto actual: si después se modifica, el contrato firmado
              sigue diciendo lo que se firmó.
            </p>
            <div className="flex gap-2">
              <button
                onClick={emitirContrato}
                disabled={guardando}
                className="flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-hover disabled:opacity-40"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Emitir contrato
              </button>
              <button
                onClick={() => setAbrirForm(false)}
                disabled={guardando}
                className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {contrato && !abrirForm && (
          <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="text-sm space-y-0.5">
                <p className="font-bold text-brand-ink">{contrato.numero}</p>
                <p className="text-slate-500">Total contratado: <span className="font-semibold text-brand-ink">{usd(contrato.monto_total_usd)}</span></p>
                <p className="text-slate-500">
                  Plazo: {contrato.plazo_entrega_dias} días · Inicio {fecha(contrato.fecha_inicio)} · Anticipo {contrato.anticipo_pct}%
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/proyectos/contrato?proyectoId=${proyectoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-white text-brand-ink border border-gray-200 px-4 py-2 rounded-xl font-bold text-sm hover:border-brand-ink transition-all"
                >
                  <Download className="w-4 h-4" /> Ver contrato
                </a>
                {!firmado && (
                  <button
                    onClick={() => setAbrirForm(true)}
                    className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-200"
                  >
                    Corregir condiciones
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Paso>

      {/* ── Paso 2: firma ─────────────────────────────────────── */}
      <Paso
        n={2}
        titulo="Firma del contrato"
        estado={firmado ? 'hecho' : contrato ? 'activo' : 'pendiente'}
      >
        {!contrato && <p className="text-sm text-slate-500">Primero hay que emitir el contrato.</p>}

        {contrato && !firmado && (
          <>
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                Esperando la firma. El cliente ya lo tiene por mail y puede firmarlo
                digitalmente desde su portal.
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-2">
              ¿Lo firmaron en papel? Subí el escaneo y queda registrado igual.
            </p>
            <input
              ref={archivoRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFirmado(f) }}
            />
            <button
              onClick={() => archivoRef.current?.click()}
              disabled={subiendo}
              className="flex items-center gap-2 bg-white text-brand-ink border border-gray-200 px-4 py-2.5 rounded-xl font-bold text-sm hover:border-brand-ink disabled:opacity-40"
            >
              {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Subir contrato firmado
            </button>
          </>
        )}

        {contrato && firmado && (
          <div className="flex items-start gap-2 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <PenLine className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-800">
                Firmado {contrato.firma_metodo === 'digital' ? 'digitalmente' : 'en papel'} por {contrato.firmado_por}
              </p>
              <p className="text-emerald-700">
                {new Date(contrato.firmado_at!).toLocaleString('es-AR')}
                {contrato.firmado_email ? ` · ${contrato.firmado_email}` : ''}
              </p>
            </div>
          </div>
        )}
      </Paso>

      {/* ── Paso 3: orden de producción ───────────────────────── */}
      <Paso
        n={3}
        titulo="Orden de producción"
        estado={orden ? 'hecho' : firmado ? 'activo' : 'pendiente'}
      >
        {!firmado && !orden && (
          <p className="text-sm text-slate-500">
            Se habilita con el contrato firmado: al taller no va nada sin la venta cerrada.
          </p>
        )}

        {firmado && !orden && (
          <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-slate-500 mb-3">
              Emite la orden con los datos técnicos y el despiece del contrato firmado, y se la manda
              por mail a oficina técnica.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className={label}>Prioridad</label>
                <select className={input} value={datosOrden.prioridad}
                        onChange={(e) => setDatosOrden({ ...datosOrden, prioridad: e.target.value })}>
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={label}>Indicaciones para el taller</label>
                <input type="text" className={input} value={datosOrden.notasTaller}
                       placeholder="Lo que oficina técnica tenga que saber y no esté en el despiece."
                       onChange={(e) => setDatosOrden({ ...datosOrden, notasTaller: e.target.value })} />
              </div>
            </div>
            <button
              onClick={emitirOrden}
              disabled={emitiendoOrden}
              className="flex items-center gap-2 bg-brand-ink text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 disabled:opacity-40"
            >
              {emitiendoOrden ? <Loader2 className="w-4 h-4 animate-spin" /> : <Factory className="w-4 h-4" />}
              Generar orden de producción
            </button>
          </div>
        )}

        {orden && (
          <div className="bg-slate-50 rounded-xl p-4 border border-gray-100 flex items-start justify-between gap-4 flex-wrap">
            <div className="text-sm space-y-0.5">
              <p className="font-bold text-brand-ink">{orden.numero}</p>
              <p className="text-slate-500">
                Entrega comprometida: <span className="font-semibold text-brand-ink">{fecha(orden.fecha_entrega_comprometida)}</span>
              </p>
              <p className="text-slate-500">Prioridad: {orden.prioridad} · Emitida el {fecha(orden.created_at)}</p>
            </div>
            <a
              href={`/api/proyectos/orden-produccion?proyectoId=${proyectoId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 bg-white text-brand-ink border border-gray-200 px-4 py-2 rounded-xl font-bold text-sm hover:border-brand-ink transition-all"
            >
              <Download className="w-4 h-4" /> Ver orden
            </a>
          </div>
        )}
      </Paso>
    </div>
  )
}
