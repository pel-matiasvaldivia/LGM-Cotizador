import { calcularBase0 } from '@/lib/calculator'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { proyectoId, datosTecnicos } = body

    if (!proyectoId || !datosTecnicos) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (proyectoId, datosTecnicos)' }, { status: 400 })
    }

    const itemsCalculados = await calcularBase0(proyectoId, datosTecnicos)

    // Save to database so PDF exporter and other flows can read them
    if (itemsCalculados.length > 0) {
       const { createClient } = await import('@/lib/supabase')
       const supabase = createClient()
       const { error: insertError } = await supabase.from('presupuesto_base_items').insert(itemsCalculados)
       if (insertError) throw insertError
    }

    return NextResponse.json({ items: itemsCalculados })
  } catch (error: any) {
    console.error('Error en API calculate:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
