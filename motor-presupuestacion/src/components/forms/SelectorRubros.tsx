'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

type SubrubroRow = {
  subrubroId: string
  subrubroNombre: string
  unidad: string
  totalUsd: number
}
type RubroGrupo = {
  id: string | null
  nombre: string
  subrubros: SubrubroRow[]
}

// Selector de alcance por catálogo real: el comercial activa/desactiva los
// rubros y subrubros que entran en ESTA cotización. La selección resultante
// (IDs de subrubro) se guarda en variables.subrubros_seleccionados y manda sobre
// la inclusión automática por módulos al calcular el Base 0.
export default function SelectorRubros({
  seleccionados,
  onChange,
}: {
  seleccionados: string[] | undefined
  onChange: (ids: string[]) => void
}) {
  const [grupos, setGrupos] = useState<RubroGrupo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let vivo = true
    fetch('/api/ratios')
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return
        const rubros: RubroGrupo[] = (d.rubros || []).map((ru: any) => ({
          id: ru.id,
          nombre: ru.nombre,
          subrubros: (ru.subrubros || []).map((s: any) => ({
            subrubroId: s.subrubroId,
            subrubroNombre: s.subrubroNombre,
            unidad: s.unidad,
            totalUsd: s.totalUsd,
          })),
        }))
        setGrupos(rubros)
        // Por defecto: todo seleccionado (el comercial desmarca lo que no aplica).
        if (seleccionados === undefined) {
          const todos = rubros.flatMap((ru) => ru.subrubros.map((s) => s.subrubroId))
          onChange(todos)
        }
      })
      .catch(() => vivo && setError('No se pudo cargar el catálogo de rubros'))
      .finally(() => vivo && setLoading(false))
    return () => { vivo = false }
    // Sólo al montar: la carga inicial del catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sel = new Set(seleccionados ?? [])

  const toggleSub = (id: string) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  const toggleRubro = (ru: RubroGrupo) => {
    const ids = ru.subrubros.map((s) => s.subrubroId)
    const todosActivos = ids.every((id) => sel.has(id))
    const next = new Set(sel)
    if (todosActivos) ids.forEach((id) => next.delete(id))
    else ids.forEach((id) => next.add(id))
    onChange(Array.from(next))
  }

  const marcarTodos = (valor: boolean) => {
    if (!valor) { onChange([]); return }
    onChange(grupos.flatMap((ru) => ru.subrubros.map((s) => s.subrubroId)))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando catálogo de rubros…
      </div>
    )
  }
  if (error) return <p className="text-sm text-red-500 py-4">{error}</p>
  if (grupos.length === 0) return <p className="text-sm text-slate-400 py-4">No hay rubros en el catálogo.</p>

  const totalSubs = grupos.reduce((n, ru) => n + ru.subrubros.length, 0)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-gray-200">
        <p className="text-sm font-semibold text-[#1B2A47]">
          Seleccionados: {sel.size} / {totalSubs}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => marcarTodos(true)} className="text-[#F05A28] font-semibold hover:underline">Marcar todo</button>
          <button type="button" onClick={() => marcarTodos(false)} className="text-slate-500 font-semibold hover:underline">Desmarcar todo</button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
        {grupos.map((ru) => {
          const ids = ru.subrubros.map((s) => s.subrubroId)
          const activos = ids.filter((id) => sel.has(id)).length
          const todos = activos === ids.length && ids.length > 0
          const key = ru.id ?? ru.nombre
          const open = abierto[key] ?? false
          return (
            <div key={key}>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={todos}
                  ref={(el) => { if (el) el.indeterminate = activos > 0 && !todos }}
                  onChange={() => toggleRubro(ru)}
                  className="w-4 h-4 accent-[#F05A28]"
                />
                <button
                  type="button"
                  onClick={() => setAbierto((a) => ({ ...a, [key]: !open }))}
                  className="flex items-center gap-1 flex-1 text-left"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-semibold text-sm text-[#1B2A47]">{ru.nombre}</span>
                  <span className="text-xs text-slate-400 ml-1">({activos}/{ids.length})</span>
                </button>
              </div>
              {open && (
                <div className="pl-9 pr-3 pb-2 space-y-1 bg-slate-50/50">
                  {ru.subrubros.map((s) => (
                    <label key={s.subrubroId} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sel.has(s.subrubroId)}
                        onChange={() => toggleSub(s.subrubroId)}
                        className="w-4 h-4 accent-[#F05A28]"
                      />
                      <span className="flex-1 text-slate-700">{s.subrubroNombre}</span>
                      <span className="text-xs text-slate-400">{s.unidad}</span>
                    </label>
                  ))}
                  {ru.subrubros.length === 0 && (
                    <p className="text-xs text-slate-400 py-1">Sin subrubros.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
