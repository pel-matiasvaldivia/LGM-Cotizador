// Acceso a datos acotado al tenant del request. Es el cuello de botella por el
// que pasan las rutas que reciben un id: si el dato no es de la empresa del
// dominio, no existe (404), nunca "prohibido" — no queremos confirmarle a nadie
// que el id de otra empresa es válido.
//
// Regla: todo lo que cuelga de un proyecto (datos técnicos, ítems, documentos)
// se valida una vez contra el proyecto, y después se consulta por proyectoId.

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  documentosProyecto, presupuestoBaseItems, proyectos, ratiosCostos, rubros, subrubros,
  type Proyecto,
} from '@/db/schema'
import { AuthError } from '@/lib/errors'
import { requireTenant } from '@/lib/tenant'

/** Proyecto de la empresa actual, o null si no existe o es de otra. */
export async function proyectoDelTenant(proyectoId: string): Promise<Proyecto | null> {
  const tenant = await requireTenant()
  const fila = await db.query.proyectos.findFirst({
    where: and(eq(proyectos.id, proyectoId), eq(proyectos.tenantId, tenant.id)),
  })
  return fila ?? null
}

/** Igual que proyectoDelTenant(), pero corta con 404 en vez de devolver null. */
export async function requireProyecto(proyectoId: string): Promise<Proyecto> {
  const proyecto = await proyectoDelTenant(proyectoId)
  if (!proyecto) throw new AuthError('Proyecto no encontrado', 404)
  return proyecto
}

/** Ítem de presupuesto, validando que su proyecto sea de la empresa actual. */
export async function requireItem(itemId: string) {
  const item = await db.query.presupuestoBaseItems.findFirst({
    where: eq(presupuestoBaseItems.id, itemId),
  })
  if (!item) throw new AuthError('Ítem no encontrado', 404)
  await requireProyecto(item.proyectoId)
  return item
}

/** Documento adjunto, validando que su proyecto sea de la empresa actual. */
export async function requireDocumento(documentoId: string) {
  const doc = await db.query.documentosProyecto.findFirst({
    where: eq(documentosProyecto.id, documentoId),
  })
  if (!doc) throw new AuthError('Documento no encontrado', 404)
  await requireProyecto(doc.proyectoId)
  return doc
}

/**
 * Ratio del catálogo. El tenant no está en la fila del ratio: cuelga de
 * subrubro → rubro, así que se valida subiendo por esa cadena.
 */
export async function requireRatio(ratioId: string) {
  const tenant = await requireTenant()
  const [fila] = await db
    .select({ ratio: ratiosCostos, subrubroId: subrubros.id })
    .from(ratiosCostos)
    .innerJoin(subrubros, eq(ratiosCostos.subrubroId, subrubros.id))
    .innerJoin(rubros, eq(subrubros.rubroId, rubros.id))
    .where(and(eq(ratiosCostos.id, ratioId), eq(rubros.tenantId, tenant.id)))
    .limit(1)
  if (!fila) throw new AuthError('Ratio no encontrado', 404)
  return fila.ratio
}

/** Rubro de la empresa actual. */
export async function requireRubro(rubroId: string) {
  const tenant = await requireTenant()
  const fila = await db.query.rubros.findFirst({
    where: and(eq(rubros.id, rubroId), eq(rubros.tenantId, tenant.id)),
  })
  if (!fila) throw new AuthError('Rubro no encontrado', 404)
  return fila
}
