'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'
import { fecha, NOMBRE_SECTOR, type Etapa, type Sector } from './tipos'

// El tablero no es un listado más de proyectos: ordena por quién tiene la
// pelota. Lo que espera por el sector de quien mira va primero, y después lo
// demás por fecha de entrega comprometida.

interface Fila {
  orden_id: string
  proyecto_id: string
  codigo: string
  cliente: string
  ubicacion: string
  numero: string
  prioridad: string
  fecha_entrega_comprometida: string
  etapa: Etapa
  etapa_titulo: string
  sector: Sector | null
  sector_titulo: string
  mia: boolean
  etapa_at: string | null
}

const COLOR_ETAPA: Record<Etapa, string> = {
  materiales: 'bg-slate-100 text-slate-600',
  verificacion: 'bg-sky-100 text-sky-700',
  compras: 'bg-amber-100 text-amber-700',
  recepcion: 'bg-amber-100 text-amber-700',
  fabricacion: 'bg-indigo-100 text-indigo-700',
  despacho: 'bg-violet-100 text-violet-700',
  obra: 'bg-emerald-100 text-emerald-700',
  cerrada: 'bg-slate-100 text-slate-400',
}

export default function TableroProduccion() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [misSectores, setMisSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/produccion/bandeja')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo leer el tablero')
        if (!vivo) return
        setFilas(data.ordenes)
        setMisSectores(data.mis_sectores)
      })
      .catch((err) => vivo && setError(err instanceof Error ? err.message : 'Error'))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [])

  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    )
  }
  if (error) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        <AlertTriangle className="h-4 w-4" /> {error}
      </p>
    )
  }
  if (filas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Todavía no hay obras con orden de producción emitida.
      </p>
    )
  }

  const mias = filas.filter((f) => f.mia && f.etapa !== 'cerrada')
  const resto = filas.filter((f) => !mias.includes(f))

  return (
    <div className="space-y-6">
      {misSectores.length > 0 && (
        <Grupo
          titulo={mias.length > 0 ? 'Esperando por vos' : 'Nada esperando por vos'}
          subtitulo={misSectores.map((s) => NOMBRE_SECTOR[s]).join(' · ')}
          filas={mias}
        />
      )}
      <Grupo titulo={misSectores.length > 0 ? 'El resto de las obras' : 'Obras en producción'} filas={resto} />
    </div>
  )
}

function Grupo({ titulo, subtitulo, filas }: { titulo: string; subtitulo?: string; filas: Fila[] }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="font-bold text-brand-ink">{titulo}</h2>
        {subtitulo && <span className="text-xs text-slate-400">{subtitulo}</span>}
      </div>
      {filas.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nada por acá.</p>
      ) : (
        <div className="space-y-2">
          {filas.map((f) => (
            <Link
              key={f.orden_id}
              href={`/proyectos/${f.proyecto_id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-brand"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand-ink">
                  {f.codigo} · {f.cliente}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {f.numero}
                  {f.ubicacion ? ` · ${f.ubicacion}` : ''}
                  {f.fecha_entrega_comprometida ? ` · entrega ${fecha(f.fecha_entrega_comprometida)}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ETAPA[f.etapa]}`}>
                  {f.etapa_titulo}
                </span>
                {f.sector_titulo && <p className="mt-0.5 text-[10px] text-slate-400">{f.sector_titulo}</p>}
              </div>
              {f.prioridad === 'alta' && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Urgente</span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
