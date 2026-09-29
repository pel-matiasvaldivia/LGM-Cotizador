import { and, eq, inArray, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { configuracion, ratiosCostos, rubros, subrubros } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { requireTenant } from '@/lib/tenant'

export const GET = withErrorHandling(async () => {
  await requireUser(['comercial', 'admin'])
  const tenant = await requireTenant()
  const config = await db.query.configuracion.findFirst({
    where: and(eq(configuracion.tenantId, tenant.id), eq(configuracion.clave, 'tipo_cambio_usd')),
  })
  return NextResponse.json({ tipo_cambio: typeof config?.valor === 'number' ? config.valor : null })
})

// Actualiza el tipo de cambio y recalcula precio_unitario_ars de todos los ratios vigentes
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])
  const tenant = await requireTenant()

  const { tipo_cambio } = await req.json()
  const tc = Number(tipo_cambio)
  if (!Number.isFinite(tc) || tc <= 0) {
    return NextResponse.json({ error: 'Tipo de cambio inválido' }, { status: 400 })
  }

  await db.transaction(async (tx) => {
    // Sólo los ratios del catálogo de esta empresa (ratio → subrubro → rubro).
    const subrubrosDelTenant = tx
      .select({ id: subrubros.id })
      .from(subrubros)
      .innerJoin(rubros, eq(subrubros.rubroId, rubros.id))
      .where(eq(rubros.tenantId, tenant.id))

    await tx.update(ratiosCostos)
      .set({
        precioUnitarioArs: sql`${ratiosCostos.precioUnitarioUsd} * ${tc}`,
        fechaActualizacion: new Date(),
      })
      .where(and(
        eq(ratiosCostos.vigente, true),
        inArray(ratiosCostos.subrubroId, subrubrosDelTenant),
      ))

    await tx.insert(configuracion)
      .values({ tenantId: tenant.id, clave: 'tipo_cambio_usd', valor: tc, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [configuracion.tenantId, configuracion.clave],
        set: { valor: tc, updatedAt: new Date() },
      })
  })

  return NextResponse.json({ success: true, tipo_cambio: tc })
})
