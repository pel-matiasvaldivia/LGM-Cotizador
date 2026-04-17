import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { canal, variables } = body

    if (!variables) {
      return NextResponse.json({ error: 'Faltan variables' }, { status: 400 })
    }

    const supabase = createClient()

    // 1. Crear el proyecto
    const codigo = `PROY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    
    const { data: proyecto, error: pError } = await supabase
      .from('proyectos')
      .insert({
        codigo,
        cliente: variables.cliente || 'Consumidor Final',
        ubicacion: variables.ubicacion || '',
        canal_origen: canal || 'manual',
        estado: 'borrador'
      })
      .select()
      .single()

    if (pError) throw pError

    // 2. Guardar datos técnicos (R-09)
    const { error: dError } = await supabase
      .from('datos_tecnicos')
      .insert({
        proyecto_id: proyecto.id,
        ancho: variables.ancho_m,
        largo: variables.largo_m,
        superficie: variables.superficie_m2,
        altura_libre: variables.altura_libre_m,
        tipologia: variables.tipologia,
        incluye_fabricacion: variables.incluye_fabricacion,
        incluye_montaje: variables.incluye_montaje,
        incluye_cubierta: variables.incluye_cubierta,
        incluye_cerramiento_lateral: variables.incluye_cerramiento_lateral,
        incluye_portones: variables.incluye_portones,
        raw_data: variables
      })

    if (dError) throw dError

    return NextResponse.json({ proyectoId: proyecto.id, codigo: proyecto.codigo })
  } catch (error: any) {
    console.error('Error creando proyecto:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
