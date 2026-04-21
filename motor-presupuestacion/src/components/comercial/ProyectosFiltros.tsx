'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useRef, useTransition } from 'react'
import { Search, X } from 'lucide-react'

const estadoLabels: Record<string, string> = {
  borrador:    'Borrador',
  enviado:     'Enviado',
  preaprobado: 'Preaprobado',
  aprobado:    'Aprobado',
}

export default function ProyectosFiltros({
  estadoActual,
  busquedaActual,
  estados,
}: {
  estadoActual?: string
  busquedaActual?: string
  estados: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const updateParams = (newParams: { q?: string; estado?: string }) => {
    const params = new URLSearchParams()
    // Use values directly — callers always pass both, so undefined means "clear"
    if (newParams.q) params.set('q', newParams.q)
    if (newParams.estado) params.set('estado', newParams.estado)

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const clearAll = () => {
    if (inputRef.current) inputRef.current.value = ''
    startTransition(() => router.push(pathname))
  }

  const hasFilters = !!estadoActual || !!busquedaActual

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Búsqueda */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por código o cliente..."
          defaultValue={busquedaActual ?? ''}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              updateParams({ q: (e.target as HTMLInputElement).value, estado: estadoActual })
            }
          }}
          onBlur={e => updateParams({ q: e.target.value, estado: estadoActual })}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-[#1B2A47] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F05A28] focus:border-transparent transition-shadow"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#F05A28] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Filtro por estado */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => updateParams({ q: busquedaActual, estado: undefined })}
          className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
            !estadoActual
              ? 'bg-[#1B2A47] text-white border-[#1B2A47]'
              : 'bg-white text-slate-600 border-gray-200 hover:border-slate-300'
          }`}
        >
          Todos
        </button>
        {estados.map(est => (
          <button
            key={est}
            onClick={() => updateParams({ q: busquedaActual, estado: est === estadoActual ? undefined : est })}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
              estadoActual === est
                ? 'bg-[#F05A28] text-white border-[#F05A28]'
                : 'bg-white text-slate-600 border-gray-200 hover:border-slate-300'
            }`}
          >
            {estadoLabels[est] ?? est}
          </button>
        ))}

        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
