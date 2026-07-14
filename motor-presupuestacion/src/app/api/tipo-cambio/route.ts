import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { configuracion, ratiosCostos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

export const GET = withErrorHandling(async () => {
  await requireUser(['comercial', 'admin'])
  const config = await db.query.configuracion.findFirst({
    where: eq(configuracion.clave, 'tipo_cambio_usd'),
  })
  return NextResponse.json({ tipo_cambio: typeof config?.valor === 'number' ? config.valor : null })
})

// Actualiza el tipo de cambio y recalcula precio_unitario_ars de todos los ratios vigentes
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { tipo_cambio } = await req.json()
  const tc = Number(tipo_cambio)
  if (!Number.isFinite(tc) || tc <= 0) {
    return NextResponse.json({ error: 'Tipo de cambio inválido' }, { status: 400 })
  }

  await db.transaction(async (tx) => {
    await tx.update(ratiosCostos)
      .set({
        precioUnitarioArs: sql`${ratiosCostos.precioUnitarioUsd} * ${tc}`,
        fechaActualizacion: new Date(),
      })
      .where(eq(ratiosCostos.vigente, true))

    await tx.insert(configuracion)
      .values({ clave: 'tipo_cambio_usd', valor: tc, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: configuracion.clave,
        set: { valor: tc, updatedAt: new Date() },
      })
  })

  return NextResponse.json({ success: true, tipo_cambio: tc })
})
