'use client'

import { useState } from 'react'
import { CheckCircle2, Download, Loader2, MapPin, Truck } from 'lucide-react'
import { AvisoError } from './PanelMateriales'
import { cantidad, fecha, fechaHora, input, label, type DespachoRow, type ParteRow } from './tipos'

// Pasos 6 y 7 (logística y obra): el despacho y el control de llegada.
//
// Una nave sale en varios viajes, así que cada remito es independiente y lleva
// su propia recepción. Un despacho no cuenta como entregado hasta que alguien
// de la obra lo confirma: es el único dato del circuito que aporta el destino
// y no quien despachó.

const ESTADO: Record<DespachoRow['estado'], { texto: string; clase: string }> = {
  preparado: { texto: 'Preparado', clase: 'bg-slate-100 text-slate-600' },
  en_transito: { texto: 'En viaje', clase: 'bg-amber-100 text-amber-700' },
  entregado: { texto: 'Entregado', clase: 'bg-emerald-100 text-emerald-700' },
  rechazado: { texto: 'Rechazado', clase: 'bg-red-100 text-red-700' },
}

export default function PanelLogistica({ proyectoId, partes, despachos, destino, puede, onCambio }: {
  proyectoId: string
  partes: ParteRow[]
  despachos: DespachoRow[]
  destino: string
  puede: boolean
  onCambio: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const disponibles = partes.filter((p) => p.estado === 'terminada' && p.cantidad - p.cantidad_despachada > 0.0001)

  return (
    <div className="space-y-4">
      {despachos.map((d) => (
        <Despacho key={d.id} despacho={d} puede={puede} onCambio={onCambio} onError={setError} />
      ))}

      {disponibles.length > 0 && puede && (
        <NuevoDespacho
          proyectoId={proyectoId}
          partes={disponibles}
          destino={destino}
          onCambio={onCambio}
          onError={setError}
        />
      )}

      {disponibles.length === 0 && despachos.length === 0 && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Todavía no hay partes terminadas para despachar.
        </p>
      )}

      {error && <AvisoError texto={error} />}
    </div>
  )
}

function Despacho({ despacho, puede, onCambio, onError }: {
  despacho: DespachoRow
  puede: boolean
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [abrirRecepcion, setAbrirRecepcion] = useState(false)
  const [recepcion, setRecepcion] = useState({ recibidoPor: '', conformidad: 'conforme', observaciones: '' })
  const chip = ESTADO[despacho.estado]

  const accion = async (body: Record<string, unknown>) => {
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/despachos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ despachoId: despacho.id, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el despacho')
      setAbrirRecepcion(false)
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al actualizar el despacho')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-brand-ink">{despacho.numero}</p>
          <p className="text-xs text-slate-500">
            {despacho.fecha_salida ? `Salida ${fecha(despacho.fecha_salida)}` : 'Sin fecha de salida'}
            {despacho.transporte ? ` · ${despacho.transporte}` : ''}
            {despacho.patente ? ` · ${despacho.patente}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip.clase}`}>{chip.texto}</span>
          <a
            href={`/api/produccion/despachos?despachoId=${despacho.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Remito
          </a>
        </div>
      </div>

      <ul className="space-y-0.5 text-sm text-slate-600">
        {despacho.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4">
            <span>{i.descripcion}</span>
            <span className="whitespace-nowrap">
              {despacho.recibido_at
                ? `${cantidad(i.cantidad_recibida, i.unidad)} de ${cantidad(i.cantidad, i.unidad)}`
                : cantidad(i.cantidad, i.unidad)}
            </span>
          </li>
        ))}
      </ul>

      {despacho.recibido_at ? (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <MapPin className="h-4 w-4" /> Recibido en obra por {despacho.recibido_por}
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {fechaHora(despacho.recibido_at)} · {despacho.conformidad.replace(/_/g, ' ')}
          </p>
          {despacho.observaciones_obra && (
            <p className="mt-1 text-xs text-emerald-900">{despacho.observaciones_obra}</p>
          )}
        </div>
      ) : puede && (
        <div className="mt-3 flex flex-wrap gap-2">
          {despacho.estado === 'preparado' && (
            <button
              type="button"
              onClick={() => accion({ accion: 'despachar' })}
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Salió el camión
            </button>
          )}
          {despacho.estado === 'en_transito' && !abrirRecepcion && (
            <button
              type="button"
              onClick={() => setAbrirRecepcion(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" /> Registrar llegada a obra
            </button>
          )}
        </div>
      )}

      {abrirRecepcion && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className={label}>Quién recibió en la obra</span>
              <input
                className={input}
                value={recepcion.recibidoPor}
                onChange={(e) => setRecepcion({ ...recepcion, recibidoPor: e.target.value })}
              />
            </div>
            <div>
              <span className={label}>Cómo llegó</span>
              <select
                className={input}
                value={recepcion.conformidad}
                onChange={(e) => setRecepcion({ ...recepcion, conformidad: e.target.value })}
              >
                <option value="conforme">Conforme</option>
                <option value="con_observaciones">Con observaciones</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
          </div>
          <div>
            <span className={label}>
              Observaciones{recepcion.conformidad !== 'conforme' ? ' (obligatorias)' : ''}
            </span>
            <textarea
              rows={2}
              className={input}
              placeholder="Faltantes, golpes, piezas cambiadas…"
              value={recepcion.observaciones}
              onChange={(e) => setRecepcion({ ...recepcion, observaciones: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => accion({ accion: 'recibir', ...recepcion })}
              disabled={guardando || !recepcion.recibidoPor}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Confirmar recepción'}
            </button>
            <button
              type="button"
              onClick={() => setAbrirRecepcion(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NuevoDespacho({ proyectoId, partes, destino, onCambio, onError }: {
  proyectoId: string
  partes: ParteRow[]
  destino: string
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  const [elegidas, setElegidas] = useState<Record<string, boolean>>(
    Object.fromEntries(partes.map((p) => [p.id, true])),
  )
  const [datos, setDatos] = useState({
    fechaSalida: '',
    transporte: '',
    chofer: '',
    patente: '',
    destino,
    observaciones: '',
  })
  const [guardando, setGuardando] = useState(false)

  const crear = async () => {
    const items = partes
      .filter((p) => elegidas[p.id])
      .map((p) => ({ parteId: p.id, cantidad: p.cantidad - p.cantidad_despachada }))
    if (items.length === 0) {
      onError('Elegí al menos una parte para despachar')
      return
    }
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/despachos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, items, ...datos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo armar el remito')
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al armar el remito')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-4">
      <p className="mb-2 font-bold text-brand-ink">Armar remito</p>
      <div className="mb-3 space-y-1">
        {partes.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(elegidas[p.id])}
              onChange={(e) => setElegidas({ ...elegidas, [p.id]: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span>{p.nombre}</span>
            <span className="text-xs text-slate-400">
              {cantidad(p.cantidad - p.cantidad_despachada, p.unidad)}
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className={label}>Fecha de salida</span>
          <input
            type="date"
            className={input}
            value={datos.fechaSalida}
            onChange={(e) => setDatos({ ...datos, fechaSalida: e.target.value })}
          />
        </div>
        <div>
          <span className={label}>Destino</span>
          <input className={input} value={datos.destino} onChange={(e) => setDatos({ ...datos, destino: e.target.value })} />
        </div>
        <div>
          <span className={label}>Transporte</span>
          <input className={input} value={datos.transporte} onChange={(e) => setDatos({ ...datos, transporte: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className={label}>Chofer</span>
            <input className={input} value={datos.chofer} onChange={(e) => setDatos({ ...datos, chofer: e.target.value })} />
          </div>
          <div>
            <span className={label}>Patente</span>
            <input className={input} value={datos.patente} onChange={(e) => setDatos({ ...datos, patente: e.target.value })} />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={crear}
        disabled={guardando}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
        Armar remito
      </button>
    </div>
  )
}
