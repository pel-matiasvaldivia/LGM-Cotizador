import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos, presupuestoBaseItems, proyectos } from '@/db/schema'
import { generarR04PDF } from '@/lib/pdf-generator'
import { calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'
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

  // Cascada de costeo (directo → indirectos → beneficio → IVA)
  const params = await getParametros()
  const resumen = calcularResumen(items, params, dt?.superficie ?? 0, proyecto.ubicacion)
  // Distribuye el precio de venta por línea proporcional al costo
  const markup = resumen.costoDirectoUsd ? resumen.totalSinIvaUsd / resumen.costoDirectoUsd : 1

  const itemsData = items.map((item) => ({
    descripcion: item.descripcion,
    unidad: item.unidad,
    cantidad: item.cantidad,
    precio_unitario_usd: Number(item.precioUnitarioUsd || 0) * markup,
    precio_venta_usd: Number(item.costoTotalUsd || 0) * markup,
    rubro_nombre: item.subrubro?.rubro?.nombre || 'Otros',
    subrubro_nombre: item.subrubro?.nombre || '',
  }))

  const toneladas = items
    .filter((item) => (item.unidad === 'kg' || item.unidad === 'kg/m2') && (item.subrubro?.rubro?.nombre || '').toLowerCase().includes('estructura'))
    .reduce((acc, item) => acc + Number(item.cantidad || 0), 0) / 1000

  const payloadR04 = {
    codigo: proyecto.codigo,
    cliente: proyecto.cliente,
    razon_social: proyecto.razonSocial,
    ubicacion: proyecto.ubicacion,
    tipologia: dt?.tipologia || '',
    superficie_m2: dt?.superficie || 0,
    tn_estructura: toneladas,
    total_venta_usd: resumen.totalSinIvaUsd,
    total_con_iva_usd: resumen.totalConIvaUsd,
    iva_usd: resumen.ivaUsd,
    iva_pct: params.iva,
    // Nota: el costo por m² (interno) NO se envía al PDF del cliente; sólo el
    // precio de venta por m².
    precio_m2_usd: resumen.precioM2Usd,
    tipo_cambio_usd: params.tipoCambio,
    fecha: new Date(),
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
