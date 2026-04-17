import { generarR04PDF } from '@/lib/pdf-generator'
import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const proyectoId = url.searchParams.get('proyectoId')

    if (!proyectoId) {
      return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
    }

    const supabase = createClient()

    // Traer el proyecto y sus datos técnicos
    const { data: proyecto, error: pErr } = await supabase
      .from('proyectos')
      .select('*, datos_tecnicos(*)')
      .eq('id', proyectoId)
      .single()

    if (pErr || !proyecto) {
      throw new Error('Proyecto no encontrado')
    }

    // Traer los items asociados con join de subrubros → rubros para obtener nombre de rubro
    const { data: items } = await supabase
      .from('presupuesto_base_items')
      .select('*, subrubros(nombre, rubros(nombre))')
      .eq('proyecto_id', proyectoId)

    // Calcular totales sobre los items retornados del motor base 0
    const itemsData = (items || []).map((item: any) => ({
      ...item,
      rubro_nombre: item.subrubros?.rubros?.nombre || 'Otros'
    }))
    
    const total_venta_usd = itemsData.reduce((acc: number, item: any) => acc + Number(item.precio_venta_usd || 0), 0)
    const toneladas = itemsData
       .filter((item: any) => (item.unidad === 'kg' || item.unidad === 'kg/m2') && item.rubro_nombre?.toLowerCase().includes('estructura'))
       .reduce((acc: number, item: any) => acc + Number(item.cantidad || 0), 0) / 1000

    const datosTecnicos = proyecto.datos_tecnicos?.[0] || {}

    // Enriquecer payload para el Document Comercial
    const payloadR04 = {
       ...proyecto,
       cliente: proyecto.cliente,
       ubicacion: proyecto.ubicacion,
       tipologia: datosTecnicos.tipologia || '',
       superficie_m2: datosTecnicos.superficie || datosTecnicos.superficie_m2 || 0,
       tn_estructura: toneladas,
       total_venta_usd,
       total_con_iva_usd: total_venta_usd * 1.21,
       tipo_cambio_usd: 1050, // a futuro: leer de tabla configuracion
       validez_oferta_dias: 15,
       condiciones_pago: "30% Anticipo - 70% Avance"
    }

    // Generar PDF Buffer
    const pdfBuffer = await generarR04PDF(payloadR04, itemsData)

    // Devolver el archivo PDF como stream binario
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=R04-Comercial.pdf',
      },
    })
  } catch (error: any) {
    console.error('Error generando PDF:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
