import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { ordenesProduccion } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { requireTenant } from '@/lib/tenant'
import { ETAPAS, NOMBRE_SECTOR, esSector, sincronizarEtapa, SECTORES, tituloEtapa } from '@/lib/produccion'

// Tablero del circuito: todas las obras en producción con la etapa en la que
// están y a qué sector le toca mover. Cada uno entra y ve lo suyo arriba.
//
// La etapa se recalcula al listar: es barato y evita que el tablero muestre
// una obra esperando a un sector que ya hizo su parte.

export const GET = withErrorHandling(async () => {
  const user = await requireUser(['admin', 'comercial'])
  const tenant = await requireTenant()

  const ordenes = await db.query.ordenesProduccion.findMany({
    where: eq(ordenesProduccion.tenantId, tenant.id),
    with: { proyecto: true },
    orderBy: asc(ordenesProduccion.createdAt),
  })

  const filas = []
  for (const orden of ordenes) {
    const etapa = await sincronizarEtapa(orden)
    const sector = ETAPAS.find((e) => e.clave === etapa)?.sector ?? null
    filas.push({
      orden_id: orden.id,
      proyecto_id: orden.proyectoId,
      codigo: orden.proyecto.codigo,
      cliente: orden.proyecto.razonSocial || orden.proyecto.cliente,
      ubicacion: orden.proyecto.ubicacion ?? '',
      numero: orden.numero,
      prioridad: orden.prioridad,
      fecha_entrega_comprometida: orden.fechaEntregaComprometida,
      etapa,
      etapa_titulo: tituloEtapa(etapa),
      sector,
      sector_titulo: sector ? NOMBRE_SECTOR[sector] : '',
      // Si le toca a quien está mirando, va arriba de todo.
      mia: sector ? esSector(user, sector) : false,
      etapa_at: orden.etapaAt?.toISOString() ?? null,
    })
  }

  // Primero lo que espera por mí, después por fecha de entrega comprometida.
  filas.sort((a, b) => {
    if (a.mia !== b.mia) return a.mia ? -1 : 1
    return (a.fecha_entrega_comprometida || '9999').localeCompare(b.fecha_entrega_comprometida || '9999')
  })

  return NextResponse.json({
    ordenes: filas,
    mis_sectores: SECTORES.filter((s) => esSector(user, s)),
    etapas: ETAPAS,
  })
})
