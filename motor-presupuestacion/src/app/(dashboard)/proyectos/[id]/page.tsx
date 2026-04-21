import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import ProyectoDetalle from '@/components/comercial/ProyectoDetalle'

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', id)
    .single()

  if (!proyecto) notFound()

  const { data: datosTecnicos } = await supabase
    .from('datos_tecnicos')
    .select('*')
    .eq('proyecto_id', id)
    .single()

  const { data: items } = await supabase
    .from('presupuesto_base_items')
    .select('*, rubros(nombre), subrubros(nombre)')
    .eq('proyecto_id', id)
    .order('orden')

  return (
    <ProyectoDetalle
      proyecto={proyecto}
      datosTecnicos={datosTecnicos}
      initialItems={items || []}
    />
  )
}
