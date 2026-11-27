'use client'

import { useState } from 'react'
import { Factory, Hammer, Loader2, ListPlus, Check } from 'lucide-react'
import { AvisoError } from './PanelMateriales'
import { cantidad, fechaHora, input, porSubconjunto, type MaterialRow, type ParteRow } from './tipos'

// Paso 5 (taller): qué se fabrica y cómo viene.
//
// Las partes las define oficina técnica —por defecto, una por subconjunto del
// despiece, que es como está organizada la estructura y como trabaja el
// taller— y el taller las mueve. Arrancar con material sin resolver lo frena
// el backend, no esta pantalla.

const ESTADOS: Array<{ clave: ParteRow['estado']; texto: string; clase: string }> = [
  { clave: 'pendiente', texto: 'Pendiente', clase: 'bg-slate-100 text-slate-600' },
  { clave: 'en_proceso', texto: 'En fabricación', clase: 'bg-amber-100 text-amber-700' },
  { clave: 'terminada', texto: 'Terminada', clase: 'bg-emerald-100 text-emerald-700' },
]

export default function PanelTaller({ proyectoId, partes, materiales, puedeTaller, puedeTecnica, onCambio }: {
  proyectoId: string
  partes: ParteRow[]
  materiales: MaterialRow[]
  puedeTaller: boolean
  puedeTecnica: boolean
  onCambio: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  if (partes.length === 0) {
    return (
      <div className="space-y-3">
        <DefinirPartes
          proyectoId={proyectoId}
          materiales={materiales}
          puede={puedeTecnica}
          onCambio={onCambio}
          onError={setError}
        />
        {error && <AvisoError texto={error} />}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {partes.map((p) => (
        <Parte
          key={p.id}
          proyectoId={proyectoId}
          parte={p}
          puede={puedeTaller}
          onCambio={onCambio}
          onError={setError}
        />
      ))}
      {error && <AvisoError texto={error} />}
    </div>
  )
}

function Parte({ proyectoId, parte, puede, onCambio, onError }: {
  proyectoId: string
  parte: ParteRow
  puede: boolean
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  const [guardando, setGuardando] = useState(false)
  const chip = ESTADOS.find((e) => e.clave === parte.estado)!

  const mover = async (estado: ParteRow['estado']) => {
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/partes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, parteId: parte.id, estado }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la parte')
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setGuardando(false)
    }
  }

  const siguiente: ParteRow['estado'] | null =
    parte.estado === 'pendiente' ? 'en_proceso' : parte.estado === 'en_proceso' ? 'terminada' : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
      <div className="min-w-0">
        <p className="font-semibold text-brand-ink">{parte.nombre}</p>
        <p className="text-xs text-slate-500">
          {cantidad(parte.cantidad, parte.unidad)}
          {parte.cantidad_despachada > 0 && ` · ${cantidad(parte.cantidad_despachada, parte.unidad)} despachado`}
          {parte.terminada_at && ` · terminada ${fechaHora(parte.terminada_at)}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip.clase}`}>{chip.texto}</span>
        {puede && siguiente && (
          <button
            type="button"
            onClick={() => mover(siguiente)}
            disabled={guardando}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : siguiente === 'terminada' ? <Check className="h-3.5 w-3.5" /> : <Hammer className="h-3.5 w-3.5" />}
            {siguiente === 'terminada' ? 'Terminada' : 'Arrancar'}
          </button>
        )}
      </div>
    </div>
  )
}

function DefinirPartes({ proyectoId, materiales, puede, onCambio, onError }: {
  proyectoId: string
  materiales: MaterialRow[]
  puede: boolean
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  // Por defecto, una parte por subconjunto: es como viene organizada la
  // estructura de producto y como se reparte el trabajo en el taller.
  const sugeridas = porSubconjunto(materiales).map(([nombre]) => nombre)
  const [texto, setTexto] = useState(sugeridas.join('\n'))
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const nombres = texto.split('\n').map((t) => t.trim()).filter(Boolean)
    if (nombres.length === 0) {
      onError('Escribí al menos una parte')
      return
    }
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/partes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, partes: nombres.map((nombre) => ({ nombre, cantidad: 1, unidad: 'un' })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudieron definir las partes')
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al definir las partes')
    } finally {
      setGuardando(false)
    }
  }

  if (!puede) {
    return (
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Oficina técnica tiene que definir las partes a fabricar antes de que el taller pueda
        registrar avance.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-4">
      <p className="flex items-center gap-2 font-bold text-brand-ink">
        <Factory className="h-4 w-4" /> Partes a fabricar
      </p>
      <p className="mb-2 mt-1 text-xs text-slate-500">
        Una por línea. Vienen propuestas desde los subconjuntos del despiece; sacá o agregá lo que
        haga falta.
      </p>
      <textarea
        rows={Math.max(4, sugeridas.length)}
        className={`${input} font-mono text-xs`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
        Definir partes
      </button>
    </div>
  )
}
