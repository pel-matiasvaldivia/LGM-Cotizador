// Cierre de la venta: contrato y orden de producción.
//
// Es la parte que antes pasaba fuera del sistema. Después de la reunión con el
// cliente (presencial o por Meet) el comercial cierra la venta acá, y eso
// dispara dos cosas en orden:
//
//   1. Se emite el CONTRATO, que congela el presupuesto aprobado más los
//      plazos y la forma de pago que se acordaron. Se firma digitalmente desde
//      el portal del cliente, o en papel y se sube el escaneo.
//   2. Con el contrato FIRMADO se emite la ORDEN DE PRODUCCIÓN, que es lo que
//      recibe oficina técnica para empezar.
//
// El orden importa: sin contrato firmado no hay orden de producción. Esa es la
// regla que el módulo hace cumplir, no una convención de la interfaz.

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  contratos, datosTecnicos, ordenesProduccion, presupuestoBaseItems, proyectos,
  type Contrato, type OrdenProduccion, type Proyecto,
} from '@/db/schema'
import { calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'
import { AuthError } from '@/lib/errors'

/* ─── Condiciones que se acuerdan en la reunión ───────────────── */

export interface CondicionesContrato {
  plazoEntregaDias: number
  /** ISO 'YYYY-MM-DD'. Vacío = a definir. */
  fechaInicio: string
  anticipoPct: number
  formaPago: string
  lugarEntrega: string
  garantiaMeses: number
  observaciones: string
}

const LARGO_MAX = 500

function texto(valor: unknown): string {
  return String(valor ?? '').trim().slice(0, LARGO_MAX)
}

function entero(valor: unknown, min: number, max: number): number {
  const n = Math.round(Number(valor))
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

/** Valida y normaliza lo que llega del formulario de cierre. */
export function normalizarCondiciones(body: Record<string, unknown>): CondicionesContrato {
  const fecha = texto(body.fechaInicio)
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new AuthError('La fecha de inicio debe tener formato AAAA-MM-DD', 400)
  }

  const anticipo = Number(body.anticipoPct)
  if (!Number.isFinite(anticipo) || anticipo < 0 || anticipo > 100) {
    throw new AuthError('El anticipo debe estar entre 0 y 100%', 400)
  }

  const plazo = entero(body.plazoEntregaDias, 0, 3650)
  if (plazo <= 0) {
    throw new AuthError('El plazo de entrega es obligatorio: es lo que se compromete en el contrato', 400)
  }

  return {
    plazoEntregaDias: plazo,
    fechaInicio: fecha,
    anticipoPct: anticipo,
    formaPago: texto(body.formaPago),
    lugarEntrega: texto(body.lugarEntrega),
    garantiaMeses: entero(body.garantiaMeses, 0, 240),
    observaciones: texto(body.observaciones),
  }
}

/* ─── Snapshot del presupuesto ────────────────────────────────── */

export interface SnapshotPresupuesto {
  tomadoAt: string
  datosTecnicos: Record<string, unknown> | null
  resumen: Record<string, unknown>
  items: Array<{
    descripcion: string
    unidad: string
    cantidad: number
    rubro: string
    subrubro: string
    precioVentaUsd: number
    costoMaterialUsd: number
    /** Mano de obra total. El desglose fab./montaje no está en todo catálogo. */
    costoMoUsd: number
    costoMoFabUsd: number
    costoMoMontajeUsd: number
  }>
}

/**
 * Fotografía del presupuesto de un proyecto: es lo que se firma y lo que se
 * manda al taller. Se guarda entero para que ningún recálculo posterior cambie
 * lo que dice un documento ya emitido.
 */
export async function tomarSnapshot(proyecto: Proyecto): Promise<SnapshotPresupuesto> {
  const dt = await db.query.datosTecnicos.findFirst({
    where: eq(datosTecnicos.proyectoId, proyecto.id),
  })

  const items = await db.query.presupuestoBaseItems.findMany({
    where: eq(presupuestoBaseItems.proyectoId, proyecto.id),
    with: { subrubro: { with: { rubro: true } } },
    orderBy: asc(presupuestoBaseItems.orden),
  })

  const params = await getParametros(proyecto.tenantId)
  const resumen = calcularResumen(items, params, dt?.superficie ?? 0, proyecto.ubicacion)
  // El precio de venta por línea sale de repartir la cascada sobre el costo
  // directo, igual que en el R-04 que vio el cliente.
  const markup = resumen.costoDirectoUsd ? resumen.totalSinIvaUsd / resumen.costoDirectoUsd : 1

  return {
    tomadoAt: new Date().toISOString(),
    datosTecnicos: dt ? (dt as unknown as Record<string, unknown>) : null,
    resumen: resumen as unknown as Record<string, unknown>,
    items: items.map((i) => ({
      descripcion: i.descripcion,
      unidad: i.unidad,
      cantidad: Number(i.cantidad || 0),
      rubro: i.subrubro?.rubro?.nombre || 'Otros',
      subrubro: i.subrubro?.nombre || '',
      precioVentaUsd: Number(i.costoTotalUsd || 0) * markup,
      costoMaterialUsd: Number(i.costoMaterialUsd || 0),
      costoMoUsd: Number(i.costoMoUsd || 0),
      costoMoFabUsd: Number(i.costoMoFabUsd || 0),
      costoMoMontajeUsd: Number(i.costoMoMontajeUsd || 0),
    })),
  }
}

/* ─── Numeración ──────────────────────────────────────────────── */

// El contrato y la orden heredan el sufijo del proyecto (PROY-2026-2912 →
// CT-2026-2912 → OP-2026-2912). Los tres documentos de una misma venta se leen
// de un vistazo, y la unicidad viene de la del código del proyecto.
function numeroDerivado(prefijo: string, codigoProyecto: string): string {
  const sufijo = codigoProyecto.replace(/^PROY-/i, '')
  return `${prefijo}-${sufijo}`
}

/* ─── Contrato ────────────────────────────────────────────────── */

export async function getContrato(proyectoId: string): Promise<Contrato | undefined> {
  return db.query.contratos.findFirst({ where: eq(contratos.proyectoId, proyectoId) })
}

/**
 * Emite el contrato de un proyecto pre-aprobado. Idempotente mientras no esté
 * firmado: volver a emitirlo actualiza las condiciones y vuelve a congelar el
 * presupuesto (es lo que se quiere si en la reunión cambió algo). Un contrato
 * ya firmado no se toca.
 */
export async function emitirContrato(
  proyecto: Proyecto,
  condiciones: CondicionesContrato,
  usuarioId: string,
): Promise<Contrato> {
  const existente = await getContrato(proyecto.id)
  if (existente?.firmadoAt) {
    throw new AuthError('El contrato ya está firmado: no se puede volver a emitir', 409)
  }

  if (proyecto.estado === 'borrador') {
    throw new AuthError('Primero hay que enviarle el presupuesto al cliente', 409)
  }

  const snapshot = await tomarSnapshot(proyecto)
  if (snapshot.items.length === 0) {
    throw new AuthError('El proyecto no tiene presupuesto calculado', 409)
  }

  const resumen = snapshot.resumen as {
    totalSinIvaUsd?: number
    ivaUsd?: number
    totalConIvaUsd?: number
    parametros?: { tipoCambio?: number }
  }

  const valores = {
    tenantId: proyecto.tenantId,
    proyectoId: proyecto.id,
    numero: numeroDerivado('CT', proyecto.codigo),
    plazoEntregaDias: condiciones.plazoEntregaDias,
    fechaInicio: condiciones.fechaInicio,
    anticipoPct: condiciones.anticipoPct,
    formaPago: condiciones.formaPago,
    lugarEntrega: condiciones.lugarEntrega,
    garantiaMeses: condiciones.garantiaMeses,
    observaciones: condiciones.observaciones,
    montoSinIvaUsd: Number(resumen.totalSinIvaUsd || 0),
    ivaUsd: Number(resumen.ivaUsd || 0),
    montoTotalUsd: Number(resumen.totalConIvaUsd || 0),
    tipoCambio: Number(resumen.parametros?.tipoCambio || 0),
    snapshot: snapshot as unknown as Record<string, unknown>,
    emitidoPor: usuarioId,
  }

  const [contrato] = existente
    ? await db.update(contratos).set(valores).where(eq(contratos.id, existente.id)).returning()
    : await db.insert(contratos).values(valores).returning()

  // El proyecto queda "en contrato" hasta que se firme.
  if (proyecto.estado !== 'aprobado' && proyecto.estado !== 'produccion') {
    await db.update(proyectos).set({ estado: 'contrato' }).where(eq(proyectos.id, proyecto.id))
  }

  return contrato
}

export interface DatosFirma {
  metodo: 'digital' | 'manual'
  /** Quién firma. En la firma digital es el nombre que escribe el cliente. */
  nombre: string
  email: string
  /** Trazabilidad: para la digital, el navegador; para la manual, el archivo. */
  referencia: string
}

/**
 * Registra la firma del contrato y deja el proyecto en 'aprobado'. Firmar dos
 * veces no hace nada: la primera firma es la que vale.
 */
export async function firmarContrato(contrato: Contrato, datos: DatosFirma): Promise<Contrato> {
  if (contrato.firmadoAt) return contrato

  const nombre = texto(datos.nombre)
  if (!nombre) {
    throw new AuthError('Falta el nombre de quien firma', 400)
  }

  const [firmado] = await db
    .update(contratos)
    .set({
      firmadoAt: new Date(),
      firmadoPor: nombre,
      firmadoEmail: texto(datos.email),
      firmaMetodo: datos.metodo,
      firmaReferencia: texto(datos.referencia),
    })
    .where(and(eq(contratos.id, contrato.id), eq(contratos.proyectoId, contrato.proyectoId)))
    .returning()

  await db.update(proyectos).set({ estado: 'aprobado' }).where(eq(proyectos.id, contrato.proyectoId))

  return firmado
}

/* ─── Orden de producción ─────────────────────────────────────── */

export async function getOrdenProduccion(proyectoId: string): Promise<OrdenProduccion | undefined> {
  return db.query.ordenesProduccion.findFirst({ where: eq(ordenesProduccion.proyectoId, proyectoId) })
}

export interface DatosOrden {
  prioridad: 'baja' | 'normal' | 'alta'
  notasTaller: string
}

export function normalizarDatosOrden(body: Record<string, unknown>): DatosOrden {
  const prioridad = String(body.prioridad ?? 'normal')
  return {
    prioridad: prioridad === 'baja' || prioridad === 'alta' ? prioridad : 'normal',
    notasTaller: texto(body.notasTaller),
  }
}

/** Fecha de entrega comprometida = inicio (o firma) + plazo del contrato. */
export function fechaEntrega(contrato: Contrato): string {
  const base = contrato.fechaInicio
    ? new Date(`${contrato.fechaInicio}T00:00:00Z`)
    : new Date(contrato.firmadoAt ?? Date.now())
  const entrega = new Date(base.getTime() + contrato.plazoEntregaDias * 24 * 60 * 60 * 1000)
  return entrega.toISOString().slice(0, 10)
}

/**
 * Emite la orden de producción. Exige contrato firmado: es el control que hace
 * que nadie mande algo al taller antes de tener la venta cerrada.
 */
export async function emitirOrdenProduccion(
  proyecto: Proyecto,
  datos: DatosOrden,
  usuarioId: string,
): Promise<OrdenProduccion> {
  const contrato = await getContrato(proyecto.id)
  if (!contrato) {
    throw new AuthError('No hay contrato emitido para este proyecto', 409)
  }
  if (!contrato.firmadoAt) {
    throw new AuthError('El contrato todavía no está firmado', 409)
  }

  const existente = await getOrdenProduccion(proyecto.id)
  if (existente) return existente

  // La orden sale del contrato firmado, no de un recálculo: lo que se fabrica
  // es lo que se firmó.
  const valores = {
    tenantId: proyecto.tenantId,
    proyectoId: proyecto.id,
    contratoId: contrato.id,
    numero: numeroDerivado('OP', proyecto.codigo),
    fechaEntregaComprometida: fechaEntrega(contrato),
    prioridad: datos.prioridad,
    notasTaller: datos.notasTaller,
    snapshot: contrato.snapshot as Record<string, unknown>,
    emitidaPor: usuarioId,
  }

  const [orden] = await db.insert(ordenesProduccion).values(valores).returning()

  await db.update(proyectos).set({ estado: 'produccion' }).where(eq(proyectos.id, proyecto.id))

  return orden
}
