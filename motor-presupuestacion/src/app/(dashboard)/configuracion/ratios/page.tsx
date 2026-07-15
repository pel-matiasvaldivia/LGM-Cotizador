'use client'

import { useEffect, useState } from 'react'

interface SubrubroRow {
  ratioId: string
  subrubroId: string
  subrubroNombre: string
  codigoFlexxus: number
  unidad: string
  ratioCantidad: number
  materialUsd: number
  moUsd: number
  totalUsd: number
  vigente: boolean
}
interface RubroGrupo {
  id: string | null
  nombre: string
  codigoFlexxus: number
  orden: number
  subrubros: SubrubroRow[]
}

export default function ConfiguracionRatiosPage() {
  const [rubros, setRubros] = useState<RubroGrupo[]>([])
  const [tipoCambio, setTipoCambio] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  async function fetchRatios() {
    const res = await fetch('/api/ratios')
    const data = await res.json()
    setRubros(data.rubros || [])
    setTipoCambio(Number(data.tipoCambio) || 0)
    setLoading(false)
  }

  useEffect(() => {
    let activo = true
    ;(async () => {
      const res = await fetch('/api/ratios')
      const data = await res.json()
      if (!activo) return
      setRubros(data.rubros || [])
      setTipoCambio(Number(data.tipoCambio) || 0)
      setLoading(false)
    })()
    return () => { activo = false }
  }, [])

  // Actualiza una fila en el estado local (optimista) recomputando el total.
  function actualizarLocal(ratioId: string, patch: Partial<SubrubroRow>) {
    setRubros((prev) =>
      prev.map((ru) => ({
        ...ru,
        subrubros: ru.subrubros.map((s) => {
          if (s.ratioId !== ratioId) return s
          const next = { ...s, ...patch }
          next.totalUsd = Number(next.materialUsd || 0) + Number(next.moUsd || 0)
          return next
        }),
      })),
    )
  }

  // Persiste un campo (numérico en USD, o el nombre del subrubro).
  async function guardar(ratioId: string, field: string, value: number | string) {
    const res = await fetch('/api/ratios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ratioId, field, value }),
    })
    if (!res.ok) {
      alert('Error al actualizar')
      fetchRatios()
    }
  }

  async function agregarSubrubro(rubroId: string | null) {
    if (!rubroId) return
    const res = await fetch('/api/ratios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rubroId, nombre: 'Nuevo subrubro', unidad: 'm2' }),
    })
    if (!res.ok) { alert('No se pudo agregar el subrubro'); return }
    await fetchRatios()
  }

  async function eliminarSubrubro(ratioId: string, nombre: string) {
    if (!confirm(`¿Eliminar el subrubro "${nombre}"?`)) return
    const res = await fetch(`/api/ratios?id=${ratioId}`, { method: 'DELETE' })
    if (!res.ok) { alert('No se pudo eliminar'); return }
    await fetchRatios()
  }

  const usd = (n: number) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const ars = (n: number) => (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
  const aArs = (u: number) => (u || 0) * tipoCambio
  const aUsd = (a: number) => (tipoCambio > 0 ? (a || 0) / tipoCambio : 0)

  if (loading) return <div className="p-10 text-center">Cargando ratios…</div>

  const inputUsd = 'w-24 p-1.5 border border-gray-200 rounded text-right focus:ring-1 focus:ring-[#F05A28] outline-none'
  const inputArs = 'w-28 p-1.5 border border-gray-200 rounded text-right bg-slate-50 focus:ring-1 focus:ring-[#F05A28] outline-none'

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-[#1B2A47]">Ratios de costo — Base 0</h1>
        <div className="text-sm text-slate-500 bg-slate-100 rounded-lg px-3 py-1.5">
          Tipo de cambio: <strong className="text-[#1B2A47]">$ {ars(tipoCambio)}</strong> / USD
          <span className="text-xs text-slate-400"> (Parámetros)</span>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Estructura por rubro y subrubro (igual que Flexxus). Cada subrubro es una línea independiente: editá su
        costo por unidad en <strong>USD</strong> o <strong>ARS</strong> (conversión con el tipo de cambio de Parámetros),
        renombralo, agregá nuevos o eliminalos. Los cambios impactan en nuevos presupuestos.
      </p>

      <div className="space-y-6">
        {rubros.map((ru) => (
          <div key={ru.id ?? ru.nombre} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-[#1B2A47] text-white">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono bg-white/15 rounded px-2 py-0.5">{ru.codigoFlexxus || '—'}</span>
                <h2 className="font-bold">{ru.nombre}</h2>
                <span className="text-xs text-white/50">{ru.subrubros.length} subrubro(s)</span>
              </div>
              <button
                onClick={() => agregarSubrubro(ru.id)}
                className="text-xs font-semibold bg-[#F05A28] hover:bg-orange-600 rounded-lg px-3 py-1.5 transition-colors"
              >
                + Agregar subrubro
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold min-w-[220px]">Subrubro</th>
                    <th className="px-4 py-2 text-center font-semibold">Unid.</th>
                    <th className="px-4 py-2 text-center font-semibold">Ratio</th>
                    <th className="px-4 py-2 text-right font-semibold">Material USD</th>
                    <th className="px-4 py-2 text-right font-semibold">Material ARS</th>
                    <th className="px-4 py-2 text-right font-semibold">M. Obra USD</th>
                    <th className="px-4 py-2 text-right font-semibold">M. Obra ARS</th>
                    <th className="px-4 py-2 text-right font-semibold">Total USD</th>
                    <th className="px-4 py-2 text-right font-semibold">Total ARS</th>
                    <th className="px-4 py-2 text-center font-semibold w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {ru.subrubros.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-6 text-slate-400">Sin subrubros. Agregá el primero.</td></tr>
                  ) : ru.subrubros.map((s) => (
                    <tr key={s.ratioId} className="border-t border-gray-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="w-full p-1.5 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded font-medium text-[#1B2A47] focus:ring-1 focus:ring-[#F05A28] outline-none"
                          value={s.subrubroNombre}
                          onChange={(e) => actualizarLocal(s.ratioId, { subrubroNombre: e.target.value })}
                          onBlur={(e) => guardar(s.ratioId, 'subrubro_nombre', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2 text-center text-slate-400">{s.unidad}</td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number" step="any" min="0"
                          className="w-16 p-1.5 border border-gray-200 rounded text-center focus:ring-1 focus:ring-[#F05A28] outline-none"
                          value={s.ratioCantidad}
                          onChange={(e) => actualizarLocal(s.ratioId, { ratioCantidad: Number(e.target.value) })}
                          onBlur={(e) => guardar(s.ratioId, 'ratio_cantidad', Number(e.target.value))}
                        />
                      </td>
                      {/* Material */}
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number" step="any" min="0" className={inputUsd}
                          value={s.materialUsd}
                          onChange={(e) => actualizarLocal(s.ratioId, { materialUsd: Number(e.target.value) })}
                          onBlur={(e) => guardar(s.ratioId, 'precio_material_usd', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number" step="any" min="0" className={inputArs}
                          value={Math.round(aArs(s.materialUsd))}
                          onChange={(e) => actualizarLocal(s.ratioId, { materialUsd: aUsd(Number(e.target.value)) })}
                          onBlur={(e) => guardar(s.ratioId, 'precio_material_usd', aUsd(Number(e.target.value)))}
                        />
                      </td>
                      {/* Mano de obra */}
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number" step="any" min="0" className={inputUsd}
                          value={s.moUsd}
                          onChange={(e) => actualizarLocal(s.ratioId, { moUsd: Number(e.target.value) })}
                          onBlur={(e) => guardar(s.ratioId, 'precio_mo_usd', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number" step="any" min="0" className={inputArs}
                          value={Math.round(aArs(s.moUsd))}
                          onChange={(e) => actualizarLocal(s.ratioId, { moUsd: aUsd(Number(e.target.value)) })}
                          onBlur={(e) => guardar(s.ratioId, 'precio_mo_usd', aUsd(Number(e.target.value)))}
                        />
                      </td>
                      {/* Total (derivado) */}
                      <td className="px-4 py-2 text-right font-semibold text-[#1B2A47]">{usd(s.totalUsd)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-500">$ {ars(aArs(s.totalUsd))}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => eliminarSubrubro(s.ratioId, s.subrubroNombre)}
                          title="Eliminar subrubro"
                          className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
