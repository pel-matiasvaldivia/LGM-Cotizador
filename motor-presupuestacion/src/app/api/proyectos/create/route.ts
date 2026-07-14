import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos, proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

export const POST = withErrorHandling(async (req: Request) => {
  // El wizard público registra/loguea al visitante antes de llegar acá,
  // así que siempre hay sesión (cliente, comercial o admin).
  const user = await requireUser()

  const { canal, variables } = await req.json()
  if (!variables) {
    return NextResponse.json({ error: 'Faltan variables' }, { status: 400 })
  }

  const codigo = `PROY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

  const nombreCompleto = [variables.cliente_nombre, variables.cliente_apellido]
    .filter(Boolean).join(' ').trim() || variables.cliente || 'Consumidor Final'

  // Un cliente solo puede crear proyectos asociados a su propio email
  const email = user.rol === 'cliente' ? user.email : (variables.cliente_email || null)

  const proyecto = await db.transaction(async (tx) => {
    const [p] = await tx.insert(proyectos).values({
      codigo,
      cliente: nombreCompleto,
      razonSocial: variables.cliente_empresa || null,
      contacto: nombreCompleto,
      dni: variables.cliente_dni || null,
      telefono: variables.cliente_telefono || null,
      email,
      ubicacion: variables.ubicacion || variables.ubicacion_obra || '',
      canalOrigen: canal || 'manual',
      estado: 'borrador',
      observaciones: variables.observaciones || null,
    }).returning()

    await tx.insert(datosTecnicos).values({
      proyectoId: p.id,
      ancho: numOrNull(variables.ancho_m),
      largo: numOrNull(variables.largo_m),
      superficie: numOrNull(variables.superficie_m2),
      alturaLibre: numOrNull(variables.altura_libre_m),
      tipologia: variables.tipologia || null,
      tipoCubierta: variables.tipo_cubierta || null,
      tipoCerramiento: variables.tipo_cerramiento || null,
      incluyeFabricacion: variables.incluye_fabricacion ?? true,
      incluyeMontaje: variables.incluye_montaje ?? true,
      incluyeCubierta: variables.incluye_cubierta ?? true,
      incluyeCerramientoLateral: variables.incluye_cerramiento_lateral ?? false,
      incluyePortones: variables.incluye_portones ?? false,
      incluyePiso: variables.incluye_piso_industrial ?? false,
      incluyeElectrica: variables.incluye_instalacion_electrica ?? false,
      incluyeSanitaria: variables.incluye_instalacion_sanitaria ?? false,
      cantidadPortones: variables.cantidad_portones ? Number(variables.cantidad_portones) : null,
      especificacionesAdicionales: variables.observaciones || null,
      rawData: variables,
    })

    return p
  })

  return NextResponse.json({ proyectoId: proyecto.id, codigo: proyecto.codigo })
})

function numOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n !== 0 ? n : null
}
