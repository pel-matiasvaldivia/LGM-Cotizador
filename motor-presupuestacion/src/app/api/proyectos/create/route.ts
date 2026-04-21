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

    const codigo = `PROY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    const nombreCompleto = [variables.cliente_nombre, variables.cliente_apellido]
      .filter(Boolean).join(' ').trim() || variables.cliente || 'Consumidor Final'

    const { data: proyecto, error: pError } = await supabase
      .from('proyectos')
      .insert({
        codigo,
        cliente: nombreCompleto,
        razon_social: variables.cliente_empresa || null,
        contacto: nombreCompleto,
        telefono: variables.cliente_telefono || null,
        email: variables.cliente_email || null,
        ubicacion: variables.ubicacion || variables.ubicacion_obra || '',
        canal_origen: canal || 'manual',
        estado: 'borrador',
      })
      .select()
      .single()

    if (pError) throw pError

    const { error: dError } = await supabase
      .from('datos_tecnicos')
      .insert({
        proyecto_id: proyecto.id,
        ancho: variables.ancho_m,
        largo: variables.largo_m,
        superficie: variables.superficie_m2,
        altura_libre: variables.altura_libre_m,
        tipologia: variables.tipologia,
        incluye_fabricacion: variables.incluye_fabricacion ?? true,
        incluye_montaje: variables.incluye_montaje ?? true,
        incluye_cubierta: variables.incluye_cubierta ?? true,
        incluye_cerramiento_lateral: variables.incluye_cerramiento_lateral ?? false,
        incluye_portones: variables.incluye_portones ?? false,
        incluye_piso: variables.incluye_piso_industrial ?? false,
        incluye_electrica: variables.incluye_instalacion_electrica ?? false,
        incluye_sanitaria: variables.incluye_instalacion_sanitaria ?? false,
        tipo_cubierta: variables.tipo_cubierta,
        tipo_cerramiento: variables.tipo_cerramiento,
        cantidad_portones: variables.cantidad_portones || null,
        especificaciones_adicionales: variables.observaciones || null,
        raw_data: variables,
      })

    if (dError) throw dError

    return NextResponse.json({ proyectoId: proyecto.id, codigo: proyecto.codigo })
  } catch (error: any) {
    console.error('Error creando proyecto:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
