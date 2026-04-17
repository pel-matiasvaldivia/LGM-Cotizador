import { extraerVariablesR09 } from '@/lib/extractor'
import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { texto, proyectoId } = body

    if (!texto) {
      return NextResponse.json({ error: 'Falta proveer texto para extraer' }, { status: 400 })
    }

    const variables = await extraerVariablesR09(texto)

    // Si se pasa un proyectoId, podemos guardar los datos extraídos en datos_tecnicos
    let datosTecnicosId = null
    if (proyectoId) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('datos_tecnicos')
        .insert({
          proyecto_id: proyectoId,
          ...variables,
          raw_data: variables
        })
        .select('id')
        .single()

      if (error) throw error
      datosTecnicosId = data?.id
    }

    return NextResponse.json({ variables, datos_tecnicos_id: datosTecnicosId })
  } catch (error: any) {
    console.error('Error en API extract:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
