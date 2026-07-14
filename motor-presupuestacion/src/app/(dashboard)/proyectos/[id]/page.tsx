import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { datosTecnicos, presupuestoBaseItems, proyectos } from '@/db/schema'
import { datosTecnicosToRow, itemToRow, proyectoToRow } from '@/lib/serializers'
import { isUuid } from '@/lib/api-helpers'
import ProyectoDetalle from '@/components/comercial/ProyectoDetalle'

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, id) })
  if (!proyecto) notFound()

  const dt = await db.query.datosTecnicos.findFirst({ where: eq(datosTecnicos.proyectoId, id) })

  const items = await db.query.presupuestoBaseItems.findMany({
    where: eq(presupuestoBaseItems.proyectoId, id),
    with: { rubro: true, subrubro: true },
    orderBy: asc(presupuestoBaseItems.orden),
  })

  return (
    <ProyectoDetalle
      proyecto={proyectoToRow(proyecto)}
      datosTecnicos={dt ? datosTecnicosToRow(dt) : null}
      initialItems={items.map(itemToRow)}
    />
  )
}
