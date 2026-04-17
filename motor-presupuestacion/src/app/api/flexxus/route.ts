import { sincronizarConFlexxus } from '@/lib/flexxus'
import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { proyectoId } = await req.json()
    if (!proyectoId) return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })

    const supabase = createClient()

    const { data: proyecto } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', proyectoId)
      .single()

    const { data: items } = await supabase
      .from('presupuesto_base_items')
      .select('*, rubro:rubros(*), subrubro:subrubros(*)')
      .eq('proyecto_id', proyectoId)
      .eq('incluido', true)

    if (!proyecto || !items) {
      return NextResponse.json({ error: 'Proyecto o items no encontrados' }, { status: 404 })
    }

    const resultado = await sincronizarConFlexxus(proyectoId, proyecto.cliente, items)

    // Si es CSV, devolver como descarga
    if (resultado.metodo === 'csv') {
      return new NextResponse(resultado.csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="Flexxus_${proyecto.codigo}.csv"`,
        },
      })
    }

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error('Error sincronizando con Flexxus:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
