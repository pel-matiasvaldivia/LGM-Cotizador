'use client'

import { useState } from "react"
import { createClient } from "@/lib/supabase"

export default function TipoCambioPage() {
  const [usd, setUsd] = useState(1050.50)
  const [loading, setLoading] = useState(false)

  async function handleUpdate() {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // 1. Obtener todos los ratios vigentes
      const { data: ratios } = await supabase.from('ratios_costos').select('*').eq('vigente', true)
      
      if (!ratios) return

      // 2. Actualizar precio_unitario_ars basado en el nuevo USD
      const updates = (ratios as any[]).map((r: any) => ({
        ...r,
        precio_unitario_ars: r.precio_unitario_usd * usd,
        fecha_actualizacion: new Date().toISOString()
      }))

      const { error } = await supabase.from('ratios_costos').upsert(updates)
      if (error) throw error

      alert('Tipo de cambio actualizado y ratios recalculados.')
    } catch (e) {
      alert('Error actualizando tipo de cambio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-[#1B2A47] mb-6">Tipo de Cambio / Cotizaciones</h1>
      
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Dólar Oficial (BNA)</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Cotización Venta (ARS)</label>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
              <input 
                type="number" 
                step="0.01"
                className="block w-full pl-8 rounded-md border-gray-300 shadow-sm p-2 border text-lg" 
                value={usd}
                onChange={(e) => setUsd(Number(e.target.value))}
              />
            </div>
          </div>
          <button 
            onClick={handleUpdate}
            disabled={loading}
            className="bg-[#1B2A47] text-white px-6 py-2 rounded-md hover:bg-[#1B2A47]/90 h-[46px] font-semibold disabled:opacity-50"
          >
            {loading ? 'Sincronizando...' : 'Actualizar Manualmente'}
          </button>
          <button className="border border-[#1B2A47] text-[#1B2A47] px-6 py-2 rounded-md hover:bg-gray-50 h-[46px] font-semibold">
            Sincronizar BCRA
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Al actualizar, el sistema recalcula automáticamente todos los costos en pesos basados en el valor unitario en dólares definido en la tabla de ratios.
        </p>
      </div>
    </div>
  )
}
