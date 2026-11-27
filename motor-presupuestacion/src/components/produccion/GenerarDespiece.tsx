'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Ruler, Wand2 } from 'lucide-react'
import { cantidad, input, label } from './tipos'

// El despiece propuesto desde la cotización.
//
// La plataforma ya sabe la geometría de la obra; lo que aporta esta pantalla
// es de DÓNDE salen los kilos: de la obra ya hecha más parecida, escalada.
// Por eso lo primero que se muestra no son las cantidades sino la obra de la
// que salieron y en qué se diferencia, que es lo que oficina técnica necesita
// para decidir si la propuesta sirve.

interface LineaPropuesta {
  subconjunto: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  cantidad_origen: number
  base: string
  base_nombre: string
}

interface Propuesta {
  obra: {
    id: string; nombre: string; tipologia: string
    ancho: number; largo: number; altura_libre: number; superficie: number
  }
  geometria: { tipologia: string; ancho: number; largo: number; alturaLibre: number; superficie: number }
  diferencias: string[]
  factores: Record<string, { nombre: string; factor: number }>
  lineas: LineaPropuesta[]
  advertencias: string[]
  obras: Array<{
    id: string; nombre: string; tipologia: string
    superficie: number; ancho: number; altura_libre: number; diferencias: string[]
  }>
}

export default function GenerarDespiece({ proyectoId, onCambio }: {
  proyectoId: string
  onCambio: () => void
}) {
  const [propuesta, setPropuesta] = useState<Propuesta | null>(null)
  const [obraId, setObraId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  const pedir = useCallback(async (forzarObra?: string) => {
    setCargando(true)
    setError(null)
    try {
      const url = `/api/produccion/generar?proyectoId=${proyectoId}${forzarObra ? `&obraId=${forzarObra}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el despiece')
      setPropuesta(data)
      setObraId(data.obra.id)
      setAbierto(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar')
      setAbierto(false)
    } finally {
      setCargando(false)
    }
  }, [proyectoId])

  useEffect(() => { void pedir() }, [pedir])

  const aplicar = async () => {
    setAplicando(true)
    setError(null)
    try {
      const res = await fetch('/api/produccion/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, obraId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo aplicar el despiece')
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar')
    } finally {
      setAplicando(false)
    }
  }

  if (cargando && !propuesta) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando la obra más parecida…
      </p>
    )
  }

  // Sin obras de referencia todavía no hay de dónde escalar: el mensaje del
  // backend explica que la primera vez hay que subir una.
  if (!propuesta) {
    return error ? <Aviso texto={error} /> : null
  }

  const g = propuesta.geometria
  const o = propuesta.obra

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
        <p className="flex items-center gap-2 font-bold text-brand-ink">
          <Wand2 className="h-4 w-4 text-brand" /> Despiece propuesto
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Escalado de <strong>{o.nombre}</strong>, que es la obra ya hecha más parecida a esta.
        </p>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <Medida titulo="Esta obra" g={{ ...g, alturaLibre: g.alturaLibre }} />
          <Medida
            titulo="Obra de referencia"
            g={{ tipologia: o.tipologia, ancho: o.ancho, largo: o.largo, alturaLibre: o.altura_libre, superficie: o.superficie }}
          />
        </div>

        {propuesta.diferencias.length > 0 && (
          <p className="mt-2 text-xs text-amber-800">
            Se diferencian en: {propuesta.diferencias.join(' · ')}.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {Object.entries(propuesta.factores).map(([base, f]) => (
            <span key={base}>
              {f.nombre}: <strong className="text-brand-ink">×{f.factor}</strong>
            </span>
          ))}
        </div>

        {propuesta.advertencias.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            {propuesta.advertencias.map((a, i) => (
              <li key={i} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={aplicar}
            disabled={aplicando}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {aplicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Usar estos {propuesta.lineas.length} renglones
          </button>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {abierto ? 'Ocultar el detalle' : 'Ver el detalle'}
          </button>
        </div>

        {propuesta.obras.length > 1 && (
          <div className="mt-3">
            <span className={label}>Escalar de otra obra</span>
            <select
              className={input}
              value={obraId ?? ''}
              onChange={(e) => { setObraId(e.target.value); void pedir(e.target.value) }}
            >
              {propuesta.obras.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} — {Math.round(x.superficie)} m², luz {x.ancho} m
                  {x.diferencias.length > 0 ? ` (${x.diferencias.length} diferencias)` : ' (idéntica)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {abierto && (
        <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left text-slate-500">
              <tr>
                <th className="p-2">Subconjunto</th>
                <th className="p-2">Artículo</th>
                <th className="p-2 text-right">En la referencia</th>
                <th className="p-2 text-right">Propuesto</th>
                <th className="p-2">Escala por</th>
              </tr>
            </thead>
            <tbody>
              {propuesta.lineas.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-2 text-slate-500">{l.subconjunto || '—'}</td>
                  <td className="p-2">{l.descripcion}</td>
                  <td className="p-2 text-right text-slate-400">{cantidad(l.cantidad_origen, l.unidad)}</td>
                  <td className="p-2 text-right font-semibold">{cantidad(l.cantidad, l.unidad)}</td>
                  <td className="p-2 text-slate-400">{l.base_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <Aviso texto={error} />}
    </div>
  )
}

function Medida({ titulo, g }: {
  titulo: string
  g: { tipologia: string; ancho: number; largo: number; alturaLibre: number; superficie: number }
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-500">
        <Ruler className="h-3 w-3" /> {titulo}
      </p>
      <p className="text-brand-ink">
        {g.ancho || '—'} × {g.largo || '—'} × {g.alturaLibre || '—'} m
        {' · '}{Math.round(g.superficie)} m²
        {g.tipologia ? ` · ${g.tipologia}` : ''}
      </p>
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="flex gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {texto}
    </p>
  )
}
