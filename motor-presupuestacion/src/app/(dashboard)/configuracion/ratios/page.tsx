'use client'

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

export default function ConfiguracionRatiosPage() {
  const [ratios, setRatios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRatios()
  }, [])

  async function fetchRatios() {
    const supabase = createClient()
    const { data } = await supabase.from('ratios_costos').select('*, subrubros(nombre)')
    setRatios(data || [])
    setLoading(false)
  }

  async function handleUpdate(id: string, field: string, value: number) {
    const supabase = createClient()
    const { error } = await supabase
      .from('ratios_costos')
      .update({ [field]: value, fecha_actualizacion: new Date().toISOString() })
      .eq('id', id)
    
    if (error) alert('Error al actualizar ratio')
    else fetchRatios()
  }

  if (loading) return <div className="p-10 text-center">Cargando ratios...</div>

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#1B2A47]">Configuración de Ratios (Base 0)</h1>
        <p className="text-sm text-gray-500 italic">Los cambios impactan en nuevos presupuestos.</p>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-[#1B2A47] border-b text-white">
            <tr>
              <th className="px-6 py-4 font-semibold">Subrubro</th>
              <th className="px-6 py-4 font-semibold">Unidad</th>
              <th className="px-6 py-4 font-semibold">Ratio</th>
              <th className="px-6 py-4 font-semibold">Costo ARS</th>
              <th className="px-6 py-4 font-semibold">Costo USD</th>
              <th className="px-6 py-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {ratios.map((ratio: any) => (
              <tr key={ratio.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{ratio.subrubros?.nombre}</td>
                <td className="px-6 py-4 text-gray-400">{ratio.unidad}</td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    className="w-20 p-1 border rounded focus:ring-1 focus:ring-[#F05A28]" 
                    defaultValue={ratio.ratio_cantidad}
                    onBlur={(e) => handleUpdate(ratio.id, 'ratio_cantidad', Number(e.target.value))}
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    className="w-24 p-1 border rounded" 
                    defaultValue={ratio.precio_unitario_ars}
                    onBlur={(e) => handleUpdate(ratio.id, 'precio_unitario_ars', Number(e.target.value))}
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    className="w-24 p-1 border rounded" 
                    defaultValue={ratio.precio_unitario_usd}
                    onBlur={(e) => handleUpdate(ratio.id, 'precio_unitario_usd', Number(e.target.value))}
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-green-600 text-xs font-bold uppercase">Vigente</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
