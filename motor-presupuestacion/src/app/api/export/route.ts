import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { configuracion, datosTecnicos, presupuestoBaseItems, proyectos } from '@/db/schema'
import { generarR04PDF } from '@/lib/pdf-generator'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const url = new URL(req.url)
  const proyectoId = url.searchParams.get('proyectoId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) throw new Error('Proyecto no encontrado')

  const dt = await db.query.datosTecnicos.findFirst({ where: eq(datosTecnicos.proyectoId, proyectoId) })

  const items = await db.query.presupuestoBaseItems.findMany({
    where: eq(presupuestoBaseItems.proyectoId, proyectoId),
    with: { subrubro: { with: { rubro: true } } },
    orderBy: asc(presupuestoBaseItems.orden),
  })

  const itemsData = items.map((item) => ({
    descripcion: item.descripcion,
    unidad: item.unidad,
    cantidad: item.cantidad,
    precio_unitario_usd: item.precioUnitarioUsd,
    precio_venta_usd: item.precioVentaUsd,
    rubro_nombre: item.subrubro?.rubro?.nombre || 'Otros',
  }))

  const total_venta_usd = itemsData.reduce((acc, item) => acc + Number(item.precio_venta_usd || 0), 0)
  const toneladas = itemsData
    .filter((item) => (item.unidad === 'kg' || item.unidad === 'kg/m2') && item.rubro_nombre?.toLowerCase().includes('estructura'))
    .reduce((acc, item) => acc + Number(item.cantidad || 0), 0) / 1000

  const config = await db.query.configuracion.findFirst({
    where: eq(configuracion.clave, 'tipo_cambio_usd'),
  })
  const tipoCambio = typeof config?.valor === 'number' ? config.valor : 1050

  const payloadR04 = {
    codigo: proyecto.codigo,
    cliente: proyecto.cliente,
    razon_social: proyecto.razonSocial,
    ubicacion: proyecto.ubicacion,
    tipologia: dt?.tipologia || '',
    superficie_m2: dt?.superficie || 0,
    tn_estructura: toneladas,
    total_venta_usd,
    total_con_iva_usd: total_venta_usd * 1.21,
    tipo_cambio_usd: tipoCambio,
    validez_oferta_dias: 15,
    condiciones_pago: '30% Anticipo - 70% Avance',
  }

  const pdfBuffer = await generarR04PDF(payloadR04, itemsData)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename=R04-Comercial.pdf',
    },
  })
})
