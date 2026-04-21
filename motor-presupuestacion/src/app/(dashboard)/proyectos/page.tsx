import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import ProyectosFiltros from '@/components/comercial/ProyectosFiltros'

const ESTADOS = ['borrador', 'enviado', 'preaprobado', 'aprobado'] as const

const estadoConfig: Record<string, { label: string; color: string }> = {
  borrador:    { label: 'Borrador',    color: 'bg-slate-100 text-slate-600' },
  enviado:     { label: 'Enviado',     color: 'bg-blue-100 text-blue-700' },
  preaprobado: { label: 'Preaprobado', color: 'bg-amber-100 text-amber-700' },
  aprobado:    { label: 'Aprobado',    color: 'bg-emerald-100 text-emerald-700' },
}

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  const { q, estado } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('proyectos')
    .select('*')
    .order('created_at', { ascending: false })

  if (estado && ESTADOS.includes(estado as any)) {
    query = query.eq('estado', estado)
  }
  if (q) {
    query = query.or(`codigo.ilike.%${q}%,cliente.ilike.%${q}%`)
  }

  const { data: proyectos } = await query

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2A47]">Proyectos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {proyectos?.length ?? 0} resultado{proyectos?.length !== 1 ? 's' : ''}
            {estado ? ` · ${estadoConfig[estado]?.label ?? estado}` : ''}
            {q ? ` · "${q}"` : ''}
          </p>
        </div>
        <Link
          href="/proyectos/nuevo"
          className="bg-[#F05A28] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-all shadow-sm"
        >
          + Nuevo proyecto
        </Link>
      </div>

      {/* Filtros (client component) */}
      <ProyectosFiltros estadoActual={estado} busquedaActual={q} estados={ESTADOS as unknown as string[]} />

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 mt-4">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-slate-50 border-b border-gray-100 text-gray-700">
            <tr>
              <th className="px-6 py-4 font-semibold">Código</th>
              <th className="px-6 py-4 font-semibold">Cliente</th>
              <th className="px-6 py-4 font-semibold hidden md:table-cell">Canal</th>
              <th className="px-6 py-4 font-semibold">Estado</th>
              <th className="px-6 py-4 font-semibold hidden md:table-cell">Fecha</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(proyectos ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                  <p className="text-base font-medium mb-1">Sin resultados</p>
                  <p className="text-sm">Probá con otro filtro o búsqueda.</p>
                </td>
              </tr>
            ) : (
              (proyectos ?? []).map((p: any) => {
                const cfg = estadoConfig[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500">{p.codigo}</td>
                    <td className="px-6 py-4 font-semibold text-[#1B2A47]">{p.cliente}</td>
                    <td className="px-6 py-4 capitalize hidden md:table-cell text-slate-500">
                      {p.canal_origen?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-slate-400 text-xs">
                      {new Date(p.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/proyectos/${p.id}`}
                        className="text-[#F05A28] font-semibold hover:underline text-sm"
                      >
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
