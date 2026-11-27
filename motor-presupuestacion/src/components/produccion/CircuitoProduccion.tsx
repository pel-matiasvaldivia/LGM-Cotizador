'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardList, Loader2, Lock } from 'lucide-react'
import PanelMateriales, { AvisoError } from './PanelMateriales'
import PanelAbastecimiento from './PanelAbastecimiento'
import PanelTaller from './PanelTaller'
import PanelLogistica from './PanelLogistica'
import { fechaHora, NOMBRE_SECTOR, type CircuitoRow, type Etapa, type Sector } from './tipos'

// El circuito completo de una obra, del despiece a la entrega.
//
// La etapa no la decide esta pantalla: viene calculada del estado real de los
// datos. Acá sólo se muestra dónde está, se abre el panel del sector que tiene
// que mover, y se deja ver lo que ya pasó.

const ORDEN: Etapa[] = ['materiales', 'verificacion', 'compras', 'recepcion', 'fabricacion', 'despacho', 'obra']

// 'compras' y 'recepcion' son el mismo tramo para quien mira de afuera: la
// obra está esperando material. Se muestran como un solo hito.
const HITOS: Array<{ etapas: Etapa[]; titulo: string; sector: Sector }> = [
  { etapas: ['materiales'], titulo: 'Despiece', sector: 'oficina_tecnica' },
  { etapas: ['verificacion'], titulo: 'Stock', sector: 'abastecimiento' },
  { etapas: ['compras', 'recepcion'], titulo: 'Materiales', sector: 'abastecimiento' },
  { etapas: ['fabricacion'], titulo: 'Fabricación', sector: 'taller' },
  { etapas: ['despacho'], titulo: 'Despacho', sector: 'logistica' },
  { etapas: ['obra'], titulo: 'En obra', sector: 'logistica' },
]

export default function CircuitoProduccion({ proyectoId, ubicacionObra }: {
  proyectoId: string
  ubicacionObra: string
}) {
  const [datos, setDatos] = useState<CircuitoRow | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/produccion?proyectoId=${proyectoId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo leer el circuito')
      setDatos(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [proyectoId])

  useEffect(() => { void cargar() }, [cargar])

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando el circuito…
      </div>
    )
  }
  if (!datos) return <AvisoError texto={error ?? 'No hay circuito de producción'} />

  const etapa = datos.orden.etapa
  const indiceActual = ORDEN.indexOf(etapa)
  const cerrada = etapa === 'cerrada'

  const cerrar = async () => {
    setCerrando(true)
    try {
      const res = await fetch('/api/produccion/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cerrar la orden')
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Linea etapa={etapa} />

      {!cerrada && (
        <Seccion
          titulo={HITOS.find((h) => h.etapas.includes(etapa))?.titulo ?? ''}
          sector={HITOS.find((h) => h.etapas.includes(etapa))?.sector}
          puede={datos.puede}
        >
          <Panel datos={datos} proyectoId={proyectoId} ubicacionObra={ubicacionObra} onCambio={cargar} />
        </Seccion>
      )}

      {/* Lo ya hecho queda a mano, plegado: la trazabilidad se consulta. */}
      {ORDEN.slice(0, Math.max(indiceActual, 0)).length > 0 && !cerrada && (
        <Anteriores datos={datos} proyectoId={proyectoId} ubicacionObra={ubicacionObra} indiceActual={indiceActual} onCambio={cargar} />
      )}

      {cerrada && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-bold">Orden cerrada</p>
          <p className="mt-0.5 text-xs">Todo entregado y confirmado en obra.</p>
        </div>
      )}

      {etapa === 'obra' && datos.puede.oficina_tecnica
        && datos.despachos.length > 0 && datos.despachos.every((d) => d.estado === 'entregado') && (
        <button
          type="button"
          onClick={cerrar}
          disabled={cerrando}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {cerrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Cerrar la orden de producción
        </button>
      )}

      <Bitacora datos={datos} />
      {error && <AvisoError texto={error} />}
    </div>
  )
}

function Panel({ datos, proyectoId, ubicacionObra, onCambio, etapa }: {
  datos: CircuitoRow
  proyectoId: string
  ubicacionObra: string
  onCambio: () => void
  etapa?: Etapa
}) {
  const actual = etapa ?? datos.orden.etapa
  switch (actual) {
    case 'materiales':
      return (
        <PanelMateriales
          proyectoId={proyectoId}
          materiales={datos.materiales}
          puede={datos.puede.oficina_tecnica}
          onCambio={onCambio}
        />
      )
    case 'verificacion':
    case 'compras':
    case 'recepcion':
      return (
        <PanelAbastecimiento
          proyectoId={proyectoId}
          materiales={datos.materiales}
          ordenesCompra={datos.ordenes_compra}
          puede={datos.puede.abastecimiento}
          onCambio={onCambio}
        />
      )
    case 'fabricacion':
      return (
        <PanelTaller
          proyectoId={proyectoId}
          partes={datos.partes}
          materiales={datos.materiales}
          puedeTaller={datos.puede.taller}
          puedeTecnica={datos.puede.oficina_tecnica}
          onCambio={onCambio}
        />
      )
    case 'despacho':
    case 'obra':
      return (
        <PanelLogistica
          proyectoId={proyectoId}
          partes={datos.partes}
          despachos={datos.despachos}
          destino={ubicacionObra}
          puede={datos.puede.logistica}
          onCambio={onCambio}
        />
      )
    default:
      return null
  }
}

function Anteriores({ datos, proyectoId, ubicacionObra, indiceActual, onCambio }: {
  datos: CircuitoRow
  proyectoId: string
  ubicacionObra: string
  indiceActual: number
  onCambio: () => void
}) {
  // Un plegable por hito ya pasado, sin repetir el tramo de materiales.
  const hechos = HITOS.filter((h) => h.etapas.every((e) => ORDEN.indexOf(e) < indiceActual))
  if (hechos.length === 0) return null

  return (
    <div className="space-y-2">
      {hechos.map((h) => (
        <details key={h.titulo} className="rounded-xl border border-slate-200">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-600">
            <Check className="h-4 w-4 text-emerald-500" /> {h.titulo}
            <span className="ml-auto text-xs font-normal text-slate-400">{NOMBRE_SECTOR[h.sector]}</span>
          </summary>
          <div className="border-t border-slate-100 p-4">
            <Panel
              datos={datos}
              proyectoId={proyectoId}
              ubicacionObra={ubicacionObra}
              onCambio={onCambio}
              etapa={h.etapas[0]}
            />
          </div>
        </details>
      ))}
    </div>
  )
}

function Linea({ etapa }: { etapa: Etapa }) {
  const indice = ORDEN.indexOf(etapa)
  const cerrada = etapa === 'cerrada'
  return (
    <div className="grid grid-cols-6 gap-1">
      {HITOS.map((h) => {
        const pos = ORDEN.indexOf(h.etapas[0])
        const hecho = cerrada || pos < indice
        const activo = !cerrada && h.etapas.includes(etapa)
        return (
          <div key={h.titulo} className="text-center">
            <div
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                hecho ? 'bg-emerald-500 text-white'
                  : activo ? 'bg-brand text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {hecho ? <Check className="h-3.5 w-3.5" /> : pos + 1}
            </div>
            <p className={`mt-1 text-[10px] leading-tight sm:text-xs ${activo ? 'font-bold text-brand-ink' : 'text-slate-500'}`}>
              {h.titulo}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function Seccion({ titulo, sector, puede, children }: {
  titulo: string
  sector?: Sector
  puede: Record<Sector, boolean>
  children: React.ReactNode
}) {
  const mio = sector ? puede[sector] : true
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-bold text-brand-ink">{titulo}</p>
        {sector && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              mio ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {!mio && <Lock className="h-3 w-3" />}
            {NOMBRE_SECTOR[sector]}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Bitacora({ datos }: { datos: CircuitoRow }) {
  if (datos.bitacora.length === 0) return null
  return (
    <details className="rounded-xl border border-slate-200">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-600">
        <ClipboardList className="h-4 w-4" /> Bitácora
        <span className="ml-auto text-xs font-normal text-slate-400">{datos.bitacora.length} movimientos</span>
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {[...datos.bitacora].reverse().map((b) => (
          <li key={b.id} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2 text-sm">
            <span className="font-semibold text-brand-ink">{b.accion}</span>
            {b.detalle && <span className="text-slate-500">{b.detalle}</span>}
            <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
              {b.usuario} · {fechaHora(b.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
