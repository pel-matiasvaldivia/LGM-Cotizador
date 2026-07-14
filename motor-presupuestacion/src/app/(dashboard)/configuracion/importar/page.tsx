'use client'

import { useState } from 'react'

interface RubroPreview {
  nombreOriginal: string
  rubroCatalogo: string | null
  codigoFlexxus: number | null
  materialUsdM2: number
  moFabUsdM2: number
  moMontajeUsdM2: number
  totalUsdM2: number
}
interface Preview {
  rubros: RubroPreview[]
  sinMapear: string[]
  advertencias: string[]
}

function usd(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ImportarBase0Page() {
  const [hoja, setHoja] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [cargando, setCargando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCargando(true)
    setError('')
    setOk('')
    setPreview(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/import/base0', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar el archivo')
      setPreview(data.preview)
      setHoja(data.hoja || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setCargando(false)
    }
  }

  async function handleAplicar() {
    if (!preview) return
    if (!confirm('Esto reemplaza los ratios de los rubros presentes en la planilla. ¿Continuar?')) return
    setAplicando(true)
    setError('')
    setOk('')
    try {
      const res = await fetch('/api/import/base0/aplicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo aplicar')
      const r = data.resultado
      setOk(`Catálogo actualizado: ${r.rubrosCreados} rubros nuevos, ${r.rubrosActualizados} actualizados, ${r.subrubros} ratios.`)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setAplicando(false)
    }
  }

  const mapeados = preview?.rubros.filter((r) => r.codigoFlexxus !== null).length ?? 0

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1B2A47]">Importar Base 0</h1>
        <p className="text-sm text-gray-500 mt-1">
          Subí la planilla <strong>Base 0</strong> (.xlsx) con los valores USD/m² por rubro. El sistema
          detecta Material / MO Fabricación / MO Montaje y actualiza el catálogo de ratios con tus números reales.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Archivo .xlsx</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleArchivo}
            disabled={cargando || aplicando}
            className="mt-2 block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#1B2A47] file:text-white file:cursor-pointer hover:file:bg-[#F05A28]"
          />
        </label>
        {cargando && <p className="mt-3 text-sm text-gray-500">Procesando planilla…</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {ok && <p className="mt-3 text-sm text-green-700 font-semibold">{ok}</p>}
      </div>

      {preview && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              Hoja <strong>{hoja}</strong> · {preview.rubros.length} rubros con valores ({mapeados} con código Flexxus)
            </p>
            <button
              onClick={handleAplicar}
              disabled={aplicando}
              className="px-5 py-2 bg-[#F05A28] text-white rounded font-semibold text-sm uppercase tracking-wider hover:bg-[#d84d20] disabled:opacity-50"
            >
              {aplicando ? 'Aplicando…' : 'Aplicar al catálogo'}
            </button>
          </div>

          {preview.advertencias.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4">
              <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                {preview.advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-[#1B2A47] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rubro</th>
                  <th className="px-4 py-3 font-semibold text-center">Flexxus</th>
                  <th className="px-4 py-3 font-semibold text-right">Material USD/m²</th>
                  <th className="px-4 py-3 font-semibold text-right">MO Fabricación</th>
                  <th className="px-4 py-3 font-semibold text-right">MO Montaje</th>
                  <th className="px-4 py-3 font-semibold text-right">Total USD/m²</th>
                </tr>
              </thead>
              <tbody>
                {preview.rubros.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.nombreOriginal}</td>
                    <td className="px-4 py-3 text-center">
                      {r.codigoFlexxus !== null ? (
                        <span className="text-green-700 font-mono">{r.codigoFlexxus}</span>
                      ) : (
                        <span className="text-amber-600 text-xs uppercase font-bold">sin mapear</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{usd(r.materialUsdM2)}</td>
                    <td className="px-4 py-3 text-right font-mono">{usd(r.moFabUsdM2)}</td>
                    <td className="px-4 py-3 text-right font-mono">{usd(r.moMontajeUsdM2)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#1B2A47]">{usd(r.totalUsdM2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
