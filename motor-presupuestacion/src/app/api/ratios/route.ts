import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ratiosCostos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

export const GET = withErrorHandling(async () => {
  await requireUser(['comercial', 'admin'])

  const ratios = await db.query.ratiosCostos.findMany({
    with: { subrubro: true },
  })

  return NextResponse.json({
    ratios: ratios.map((r) => ({
      id: r.id,
      unidad: r.unidad,
      ratio_cantidad: r.ratioCantidad,
      precio_unitario_ars: r.precioUnitarioArs,
      precio_unitario_usd: r.precioUnitarioUsd,
      vigente: r.vigente,
      subrubros: r.subrubro ? { nombre: r.subrubro.nombre } : null,
    })),
  })
})

const CAMPOS_EDITABLES = ['ratio_cantidad', 'precio_unitario_ars', 'precio_unitario_usd'] as const

export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { id, field, value } = await req.json()
  if (!id || !CAMPOS_EDITABLES.includes(field) || typeof value !== 'number' || !Number.isFinite(value)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const columna = {
    ratio_cantidad: 'ratioCantidad',
    precio_unitario_ars: 'precioUnitarioArs',
    precio_unitario_usd: 'precioUnitarioUsd',
  }[field as (typeof CAMPOS_EDITABLES)[number]] as 'ratioCantidad' | 'precioUnitarioArs' | 'precioUnitarioUsd'

  await db.update(ratiosCostos)
    .set({ [columna]: value, fechaActualizacion: new Date() })
    .where(eq(ratiosCostos.id, id))

  return NextResponse.json({ success: true })
})
