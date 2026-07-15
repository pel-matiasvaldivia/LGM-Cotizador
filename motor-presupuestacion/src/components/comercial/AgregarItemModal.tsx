'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2, X, Plus } from 'lucide-react'

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

// Modal para agregar un ítem al presupuesto: buscando en la biblioteca de
// precios de referencia, o cargando uno a medida. El comercial ajusta la
// cantidad y (opcionalmente) los costos unitarios antes de agregar.
export default function AgregarItemModal({
  saving,
  onClose,
  onAdd,
}: {
  saving: boolean
  onClose: () => void
  onAdd: (payload: Record<string, unknown>) => void
}) {
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [resultados, setResultados] = useState<PrecioRef[]>([])
  const [loading, setLoading] = useState(false)
  const [sel, setSel] = useState<PrecioRef | null>(null)

  // Formulario del ítem a agregar (prefill desde la biblioteca o a medida).
  const [descripcion, setDescripcion] = useState('')
  const [unidad, setUnidad] = useState('')
  const [cantidad, setCantidad] = useState<number>(1)
  const [unitMat, setUnitMat] = useState<number>(0)
  const [unitMo, setUnitMo] = useState<number>(0)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        if (categoria) params.set('categoria', categoria)
        const res = await fetch(`/api/precios-referencia?${params.toString()}`)
        const data = await res.json()
        setResultados(data.items || [])
        if (data.categorias && categorias.length === 0) setCategorias(data.categorias)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoria])

  const elegir = (p: PrecioRef) => {
    setSel(p)
    setDescripcion(p.descripcion)
    setUnidad(p.unidad)
    setUnitMat(p.costo_material_usd)
    setUnitMo(p.costo_ejecucion_usd)
    if (!cantidad) setCantidad(1)
  }

  const total = (Number(cantidad) || 0) * ((Number(unitMat) || 0) + (Number(unitMo) || 0))
  const puedeAgregar = descripcion.trim().length > 0 && Number(cantidad) > 0

  const agregar = () => {
    onAdd({
      descripcion: descripcion.trim(),
      unidad,
      cantidad: Number(cantidad) || 0,
      costoUnitMaterialUsd: Number(unitMat) || 0,
      costoUnitMoUsd: Number(unitMo) || 0,
      precioReferenciaId: sel?.id,
    })
  }

  const usd = (n: number) => `USD ${(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-[#1B2A47]">Agregar ítem al presupuesto</h3>
            <p className="text-xs text-slate-400">Buscá en la biblioteca de precios (Revista Cifras) o cargá uno a medida.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-0 flex-1 overflow-hidden">
          {/* Biblioteca */}
          <div className="border-r border-gray-100 flex flex-col overflow-hidden">
            <div className="p-4 space-y-2 border-b border-gray-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar ítem (ej: porcellanato, tabique, inodoro)"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F05A28] outline-none"
                />
              </div>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#F05A28]"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : resultados.length === 0 ? (
                <p className="text-center py-10 text-sm text-slate-400">Sin resultados.</p>
              ) : (
                resultados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => elegir(p)}
                    className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-orange-50 transition-colors ${sel?.id === p.id ? 'bg-orange-50' : ''}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-[#1B2A47]">{p.descripcion}</span>
                      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{usd(p.costo_total_usd)}/{p.unidad}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{p.categoria}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Formulario del ítem */}
          <div className="p-4 flex flex-col gap-3 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Elegí de la biblioteca o escribí una descripción"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#F05A28]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Cantidad</label>
                <input type="number" min="0" step="any" value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#F05A28]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Unidad</label>
                <input value={unidad} onChange={(e) => setUnidad(e.target.value)}
                  placeholder="m2, u, kg…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#F05A28]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Material u. (USD)</label>
                <input type="number" min="0" step="any" value={unitMat}
                  onChange={(e) => setUnitMat(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#F05A28]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mano de obra u. (USD)</label>
                <input type="number" min="0" step="any" value={unitMo}
                  onChange={(e) => setUnitMo(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#F05A28]" />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-slate-500">Costo total del ítem</span>
              <span className="text-lg font-bold text-[#1B2A47]">{usd(total)}</span>
            </div>
            <button
              onClick={agregar}
              disabled={!puedeAgregar || saving}
              className="mt-auto flex items-center justify-center gap-2 bg-[#F05A28] text-white py-2.5 rounded-lg font-bold hover:bg-orange-600 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar al presupuesto
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
