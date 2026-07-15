'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2, Library } from 'lucide-react'

interface PrecioRef {
  id: string
  categoria: string
  codigo: string
  descripcion: string
  unidad: string
  costo_material_usd: number
  costo_ejecucion_usd: number
  costo_total_usd: number
}

// Biblioteca de precios de referencia (Revista Cifras). Consulta de sólo lectura
// para el comercial; los ítems se agregan a una cotización desde el detalle del
// proyecto ("Agregar ítem"). Admin puede recargar la planilla desde acá.
export default function PreciosReferenciaPage() {
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [items, setItems] = useState<PrecioRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: '500' })
        if (q.trim()) params.set('q', q.trim())
        if (categoria) params.set('categoria', categoria)
        const res = await fetch(`/api/precios-referencia?${params.toString()}`)
        const data = await res.json()
        setItems(data.items || [])
        if (data.categorias) setCategorias(data.categorias)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, categoria])

  const usd = (n: number) => (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <Library className="w-6 h-6 text-[#F05A28]" />
        <h1 className="text-2xl font-bold text-[#1B2A47]">Biblioteca de precios de referencia</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Costos unitarios directos (material + ejecución) de Revista Cifras. Consultá y agregá estos ítems
        a una cotización desde el detalle del proyecto, con el botón <strong>Agregar ítem</strong>.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descripción o código"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F05A28] outline-none"
          />
        </div>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#F05A28]"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-[#1B2A47] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold text-center">Unidad</th>
                <th className="px-4 py-3 font-semibold text-right">Material</th>
                <th className="px-4 py-3 font-semibold text-right">Ejecución</th>
                <th className="px-4 py-3 font-semibold text-right">Total USD</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Sin resultados.</td></tr>
              ) : (
                items.map((p, idx) => (
                  <tr key={p.id} className={`border-b border-gray-50 ${idx % 2 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{p.categoria}</td>
                    <td className="px-4 py-2.5 text-[#1B2A47]">{p.descripcion}</td>
                    <td className="px-4 py-2.5 text-center text-slate-500">{p.unidad}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{usd(p.costo_material_usd)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{usd(p.costo_ejecucion_usd)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#1B2A47]">{usd(p.costo_total_usd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && <p className="text-xs text-slate-400 mt-3">{items.length} ítems</p>}
    </div>
  )
}
