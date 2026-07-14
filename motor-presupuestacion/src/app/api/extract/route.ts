import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos } from '@/db/schema'
import { extraerVariablesR09 } from '@/lib/extractor'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { texto, proyectoId } = await req.json()
  if (!texto) {
    return NextResponse.json({ error: 'Falta proveer texto para extraer' }, { status: 400 })
  }

  const variables = await extraerVariablesR09(texto)

  let datosTecnicosId: string | null = null
  if (proyectoId) {
    const [row] = await db.insert(datosTecnicos).values({
      proyectoId,
      ancho: variables.ancho_m ?? null,
      largo: variables.largo_m ?? null,
      superficie: variables.superficie_m2 ?? null,
      alturaLibre: variables.altura_libre_m ?? null,
      tipologia: variables.tipologia ?? null,
      tipoCubierta: variables.tipo_cubierta ?? null,
      incluyeFabricacion: variables.incluye_fabricacion ?? true,
      incluyeMontaje: variables.incluye_montaje ?? true,
      incluyeCubierta: variables.incluye_cubierta ?? true,
      incluyeCerramientoLateral: variables.incluye_cerramiento_lateral ?? false,
      incluyePortones: variables.incluye_portones ?? false,
      incluyePiso: variables.incluye_piso_industrial ?? false,
      incluyeElectrica: variables.incluye_instalacion_electrica ?? false,
      incluyeSanitaria: variables.incluye_instalacion_sanitaria ?? false,
      cantidadPortones: variables.cantidad_portones ?? null,
      especificacionesAdicionales: variables.observaciones ?? null,
      rawData: variables,
    }).returning({ id: datosTecnicos.id })
    datosTecnicosId = row.id
  }

  return NextResponse.json({ variables, datos_tecnicos_id: datosTecnicosId })
})
