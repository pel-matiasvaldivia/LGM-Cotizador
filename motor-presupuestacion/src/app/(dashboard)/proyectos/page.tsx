import Link from "next/link"
import { createClient } from "@/lib/supabase"

export default async function ProyectosPage() {
  const supabase = createClient()
  
  // Obtener proyectos recientes
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#1B2A47]">Proyectos Recientes</h1>
        <Link 
          href="/proyectos/nuevo" 
          className="bg-[#F05A28] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#F05A28]/90 transition"
        >
          + Nuevo Proyecto
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
            <tr>
              <th className="px-6 py-4 font-semibold">Código</th>
              <th className="px-6 py-4 font-semibold">Cliente</th>
              <th className="px-6 py-4 font-semibold">Canal</th>
              <th className="px-6 py-4 font-semibold">Estado</th>
              <th className="px-6 py-4 font-semibold">Fecha</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(proyectos || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No hay proyectos registrados.
                </td>
              </tr>
            ) : (
              (proyectos || []).map((proyecto: any) => (
                <tr key={proyecto.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">{proyecto.codigo}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{proyecto.cliente}</td>
                  <td className="px-6 py-4 capitalize">{proyecto.canal_origen?.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
                      {proyecto.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(proyecto.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={'/proyectos/' + proyecto.id} className="text-[#1B2A47] hover:text-[#F05A28] font-semibold">
                      Ver Detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
