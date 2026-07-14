import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { presupuestoBaseItems, proyectos } from '@/db/schema'
import { sincronizarConFlexxus } from '@/lib/flexxus'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { proyectoId } = await req.json()
  if (!isUuid(proyectoId)) return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })

  const items = await db.query.presupuestoBaseItems.findMany({
    where: and(
      eq(presupuestoBaseItems.proyectoId, proyectoId),
      eq(presupuestoBaseItems.incluido, true),
    ),
    with: { rubro: true, subrubro: true },
  })

  if (!proyecto || items.length === 0) {
    return NextResponse.json({ error: 'Proyecto o items no encontrados' }, { status: 404 })
  }

  const itemsFlexxus = items.map((item) => ({
    descripcion: item.descripcion,
    costo_total_usd: item.costoTotalUsd,
    rubro: item.rubro ? { codigo_flexxus: item.rubro.codigoFlexxus } : null,
    subrubro: item.subrubro ? { codigo_flexxus: item.subrubro.codigoFlexxus } : null,
  }))

  const resultado = await sincronizarConFlexxus(proyectoId, proyecto.cliente, itemsFlexxus)

  if (resultado.metodo === 'csv') {
    return new NextResponse(resultado.csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Flexxus_${proyecto.codigo}.csv"`,
      },
    })
  }

  return NextResponse.json(resultado)
})
