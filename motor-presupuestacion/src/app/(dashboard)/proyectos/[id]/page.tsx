import { asc, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { datosTecnicos, documentosProyecto, presupuestoBaseItems, proyectos } from '@/db/schema'
import { datosTecnicosToRow, itemToRow, proyectoToRow } from '@/lib/serializers'
import { isUuid } from '@/lib/api-helpers'
import { calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'
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

  const parametros = await getParametros()
  const resumen = calcularResumen(items, parametros, dt?.superficie ?? 0, proyecto.ubicacion)

  // Documentación adjunta por el cliente (sólo metadatos; el contenido se
  // descarga bajo demanda desde /api/documentos).
  const docsRows = await db.query.documentosProyecto.findMany({
    where: eq(documentosProyecto.proyectoId, id),
    columns: { id: true, nombre: true, tipoMime: true, tamanoBytes: true, createdAt: true },
    orderBy: desc(documentosProyecto.createdAt),
  })
  const documentos = docsRows.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    tipo_mime: d.tipoMime,
    tamano_bytes: d.tamanoBytes,
    created_at: d.createdAt.toISOString(),
  }))

  return (
    <ProyectoDetalle
      proyecto={proyectoToRow(proyecto)}
      datosTecnicos={dt ? datosTecnicosToRow(dt) : null}
      initialItems={items.map(itemToRow)}
      initialResumen={resumen}
      documentos={documentos}
    />
  )
}
