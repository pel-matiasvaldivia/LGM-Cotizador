'use client'

import { useEffect, useState } from 'react'

type Params = {
  tipoCambio: number
  iva: number
  costosIndirectos: number
  beneficio: number
  desperdicios: number
  coeficienteZona: number
  fleteCamionUsdKm: number
  fleteCamionetaUsdKm: number
  viajesCamion: number
  viajesCamioneta: number
  zonas: Record<string, number>
}

// Campos porcentuales (se guardan como fracción 0..1, se muestran como %)
const PCT: (keyof Params)[] = ['iva', 'costosIndirectos', 'beneficio', 'desperdicios', 'coeficienteZona']

export default function ParametrosPage() {
  const [p, setP] = useState<Params | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parametros')
      .then((r) => r.json())
      .then((d) => d.parametros && setP(d.parametros))
      .catch(() => setMsg('No se pudieron cargar los parámetros'))
  }, [])

  const set = (k: keyof Params, v: number) => setP((prev) => (prev ? { ...prev, [k]: v } : prev))

  async function guardar() {
    if (!p) return
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, unknown> = {
        tipo_cambio_usd: p.tipoCambio,
        iva: p.iva,
        costos_indirectos: p.costosIndirectos,
        beneficio: p.beneficio,
        desperdicios: p.desperdicios,
        coeficiente_zona: p.coeficienteZona,
        flete_camion_usd_km: p.fleteCamionUsdKm,
        flete_camioneta_usd_km: p.fleteCamionetaUsdKm,
        viajes_camion: p.viajesCamion,
        viajes_camioneta: p.viajesCamioneta,
      }
      const res = await fetch('/api/parametros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setP(data.parametros)
      setMsg('Parámetros guardados. Recalculá los proyectos para aplicarlos.')
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!p) {
    return <div className="max-w-4xl mx-auto p-6 text-slate-400">Cargando parámetros…</div>
  }

  const Num = ({ k, label, step = 'any', suffix }: { k: keyof Params; label: string; step?: string; suffix?: string }) => {
    const isPct = PCT.includes(k)
    const value = isPct ? Math.round((p[k] as number) * 10000) / 100 : (p[k] as number)
    return (
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
        <div className="relative">
          <input
            type="number"
            step={step}
            value={value}
            onChange={(e) => set(k, isPct ? Number(e.target.value) / 100 : Number(e.target.value))}
            className="block w-full rounded-lg border border-gray-200 bg-white p-2.5 pr-10 text-[#1B2A47] focus:ring-2 focus:ring-[#F05A28] focus:border-transparent outline-none"
          />
          <span className="absolute inset-y-0 right-3 flex items-center text-slate-400 text-sm">
            {suffix ?? (isPct ? '%' : '')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-[#1B2A47] mb-1">Parámetros de costeo</h1>
      <p className="text-slate-500 mb-6 text-sm">
        Estos valores arman el precio final desde el costo directo: costo → +indirectos → +beneficio → +IVA.
      </p>

      <div className="space-y-5">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-[#1B2A47] mb-4">Cascada de precio</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Num k="tipoCambio" label="Tipo de cambio (ARS/USD)" suffix="$" />
            <Num k="costosIndirectos" label="Costos indirectos" />
            <Num k="beneficio" label="Beneficio" />
            <Num k="iva" label="IVA" />
            <Num k="desperdicios" label="Desperdicios (s/ material)" />
            <Num k="coeficienteZona" label="Coef. de zona (por defecto)" />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-[#1B2A47] mb-1">Logística (fletes)</h2>
          <p className="text-xs text-slate-400 mb-4">
            El costo de flete = viajes × distancia a obra (km) × tarifa. La distancia se carga por proyecto.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Num k="fleteCamionUsdKm" label="Tarifa camión (USD/km)" suffix="US$" />
            <Num k="viajesCamion" label="Viajes de camión" />
            <Num k="fleteCamionetaUsdKm" label="Tarifa camioneta (USD/km)" suffix="US$" />
            <Num k="viajesCamioneta" label="Viajes de camioneta" />
          </div>
        </section>

        {msg && <div className="text-sm rounded-lg px-4 py-2 bg-slate-100 text-slate-600">{msg}</div>}

        <button
          onClick={guardar}
          disabled={saving}
          className="bg-[#F05A28] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Guardar parámetros'}
        </button>
      </div>
    </div>
  )
}
