// Circuito de producción: de la orden de producción a la entrega en obra.
//
// Cuatro sectores intervienen por turno y cada uno hace sólo lo suyo:
//
//   oficina_tecnica  carga el despiece de materiales y define las partes
//   abastecimiento   verifica stock, pide lo que falta y registra el ingreso
//   taller           fabrica las partes
//   logistica        despacha a la obra y controla la llegada
//
// La etapa de la orden NO se setea a mano: se deriva del estado real de los
// datos (etapaDerivada). Así la pantalla no puede mentir sobre dónde está la
// obra, y una corrección hacia atrás —aparece un faltante nuevo, un despacho
// rechazado— mueve la etapa sola en vez de dejarla desincronizada.

import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  bitacoraOrden, despachoItems, despachos, materialesOrden, ordenesCompra, ordenesCompraItems,
  ordenesProduccion, partesFabricacion, proyectos, recepcionesMaterial,
  SECTORES,
  type Despacho, type DespachoItem, type EtapaProduccion, type MaterialOrden, type OrdenCompra,
  type OrdenCompraItem, type OrdenProduccion, type ParteFabricacion, type Sector, type Usuario,
} from '@/db/schema'
import { AuthError } from '@/lib/errors'

export { SECTORES }

export const NOMBRE_SECTOR: Record<Sector, string> = {
  oficina_tecnica: 'Oficina técnica',
  abastecimiento: 'Abastecimiento',
  taller: 'Taller',
  logistica: 'Logística y obra',
}

export const ETAPAS: ReadonlyArray<{ clave: EtapaProduccion; titulo: string; sector: Sector | null }> = [
  { clave: 'materiales', titulo: 'Despiece de materiales', sector: 'oficina_tecnica' },
  { clave: 'verificacion', titulo: 'Verificación de stock', sector: 'abastecimiento' },
  { clave: 'compras', titulo: 'Compra de faltantes', sector: 'abastecimiento' },
  { clave: 'recepcion', titulo: 'Ingreso de materiales', sector: 'abastecimiento' },
  { clave: 'fabricacion', titulo: 'Fabricación', sector: 'taller' },
  { clave: 'despacho', titulo: 'Despacho a obra', sector: 'logistica' },
  { clave: 'obra', titulo: 'Recepción en obra', sector: 'logistica' },
  { clave: 'cerrada', titulo: 'Cerrada', sector: null },
]

export function tituloEtapa(etapa: EtapaProduccion): string {
  return ETAPAS.find((e) => e.clave === etapa)?.titulo ?? etapa
}

/* ─── Permisos ────────────────────────────────────────────────── */

export function esSector(usuario: Usuario, sector: Sector): boolean {
  // El admin de la empresa entra a todos los sectores: en una PyME es quien
  // destraba cuando falta alguien.
  if (usuario.rol === 'admin') return true
  return Array.isArray(usuario.sectores) && usuario.sectores.includes(sector)
}

/** Corta con 403 si el usuario no pertenece al sector que tiene que actuar. */
export function requireSector(usuario: Usuario, sector: Sector): void {
  if (usuario.rol === 'cliente') throw new AuthError('Sin permisos', 403)
  if (!esSector(usuario, sector)) {
    throw new AuthError(`Este paso lo hace ${NOMBRE_SECTOR[sector]}`, 403)
  }
}

export function normalizarSectores(valor: unknown): Sector[] {
  if (!Array.isArray(valor)) return []
  const validos = valor.filter((s): s is Sector => SECTORES.includes(s as Sector))
  return [...new Set(validos)]
}

/* ─── Estado del circuito ─────────────────────────────────────── */

export interface EstadoCircuito {
  materiales: MaterialOrden[]
  ordenesCompra: Array<OrdenCompra & { items: OrdenCompraItem[] }>
  partes: ParteFabricacion[]
  despachos: Array<Despacho & { items: DespachoItem[] }>
}

export async function leerCircuito(ordenId: string): Promise<EstadoCircuito> {
  const [materiales, ocs, partes, envios] = await Promise.all([
    db.query.materialesOrden.findMany({
      where: eq(materialesOrden.ordenId, ordenId),
      orderBy: [asc(materialesOrden.orden), asc(materialesOrden.createdAt)],
    }),
    db.query.ordenesCompra.findMany({
      where: eq(ordenesCompra.ordenId, ordenId),
      with: { items: true },
      orderBy: asc(ordenesCompra.createdAt),
    }),
    db.query.partesFabricacion.findMany({
      where: eq(partesFabricacion.ordenId, ordenId),
      orderBy: [asc(partesFabricacion.orden), asc(partesFabricacion.createdAt)],
    }),
    db.query.despachos.findMany({
      where: eq(despachos.ordenId, ordenId),
      with: { items: true },
      orderBy: asc(despachos.createdAt),
    }),
  ])
  return { materiales, ordenesCompra: ocs, partes, despachos: envios }
}

const EPS = 1e-6

/**
 * Dónde está realmente la orden, a partir de los datos. Avanza sólo cuando el
 * paso anterior está completo, y retrocede si algo se cae.
 */
export function etapaDerivada(estado: EstadoCircuito, cerradaAMano = false): EtapaProduccion {
  const { materiales, ordenesCompra: ocs, partes, despachos: envios } = estado

  if (materiales.length === 0) return 'materiales'
  if (materiales.some((m) => m.estado === 'pendiente')) return 'verificacion'

  // Faltantes todavía no incluidos en ninguna orden de compra emitida.
  const pedido = new Map<string, number>()
  for (const oc of ocs) {
    if (oc.estado === 'anulada') continue
    for (const it of oc.items) pedido.set(it.materialId, (pedido.get(it.materialId) ?? 0) + it.cantidad)
  }
  const faltantes = materiales.filter((m) => m.estado === 'faltante' || m.estado === 'pedido')
  const sinPedir = faltantes.filter((m) => {
    const necesita = Math.max(m.cantidadRequerida - m.cantidadDisponible - m.cantidadRecibida, 0)
    return necesita - (pedido.get(m.id) ?? 0) > EPS
  })
  if (sinPedir.length > 0) return 'compras'

  // Pedido pero todavía no ingresado.
  const faltaIngresar = faltantes.some(
    (m) => m.cantidadDisponible + m.cantidadRecibida + EPS < m.cantidadRequerida,
  )
  if (faltaIngresar) return 'recepcion'

  if (partes.length === 0 || partes.some((p) => p.estado !== 'terminada')) return 'fabricacion'

  const porDespachar = partes.some((p) => p.cantidadDespachada + EPS < p.cantidad)
  if (porDespachar) return 'despacho'

  const sinConfirmar = envios.some((d) => d.estado !== 'entregado')
  if (sinConfirmar) return 'obra'

  return cerradaAMano ? 'cerrada' : 'obra'
}

/**
 * Recalcula la etapa de la orden y la guarda si cambió.
 *
 * El aviso al sector que ahora tiene que mover sale sólo desde los pasos que
 * escriben (`notificar`), nunca desde una lectura: si no, abrir el tablero
 * mandaría mails.
 */
export async function sincronizarEtapa(
  orden: OrdenProduccion,
  opciones: { notificar?: boolean } = {},
): Promise<EtapaProduccion> {
  const estado = await leerCircuito(orden.id)
  const etapa = etapaDerivada(estado, orden.estado === 'cerrada')
  if (etapa === orden.etapa) return etapa

  await db
    .update(ordenesProduccion)
    .set({ etapa, etapaAt: new Date() })
    .where(eq(ordenesProduccion.id, orden.id))

  if (opciones.notificar) await avisarAlSector(orden, etapa)
  return etapa
}

async function avisarAlSector(orden: OrdenProduccion, etapa: EtapaProduccion): Promise<void> {
  const sector = ETAPAS.find((e) => e.clave === etapa)?.sector
  if (!sector) return
  try {
    // Import diferido: notificaciones arrastra el generador de PDF, y no tiene
    // por qué entrar en los bundles que sólo usan las reglas del circuito.
    const [{ notificarSectorProduccion }, proyecto] = await Promise.all([
      import('@/lib/notificaciones'),
      db.query.proyectos.findFirst({ where: eq(proyectos.id, orden.proyectoId) }),
    ])
    if (proyecto) await notificarSectorProduccion(proyecto, orden, sector, tituloEtapa(etapa))
  } catch (err) {
    // Un mail que no sale no puede frenar el circuito.
    console.error('[produccion] no se pudo avisar al sector', err)
  }
}

/* ─── Bitácora ────────────────────────────────────────────────── */

export async function anotar(
  orden: OrdenProduccion,
  usuario: Usuario,
  sector: Sector | '',
  accion: string,
  detalle = '',
): Promise<void> {
  await db.insert(bitacoraOrden).values({
    tenantId: orden.tenantId,
    ordenId: orden.id,
    proyectoId: orden.proyectoId,
    sector,
    etapa: orden.etapa,
    accion,
    detalle: detalle.slice(0, 1000),
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre || usuario.email,
  })
}

export async function leerBitacora(ordenId: string) {
  return db.query.bitacoraOrden.findMany({
    where: eq(bitacoraOrden.ordenId, ordenId),
    orderBy: asc(bitacoraOrden.createdAt),
  })
}

/* ─── Numeración ──────────────────────────────────────────────── */

// OP-2026-9394 → OC-2026-9394-1, REM-2026-9394-1. El correlativo es por orden,
// no global: así el número dice de qué obra es sin cruzar ninguna tabla.
function sufijoOrden(numeroOrden: string): string {
  return numeroOrden.replace(/^[A-Z]+-/, '')
}

async function proximoNumero(prefijo: string, orden: OrdenProduccion, usados: string[]): Promise<string> {
  const base = `${prefijo}-${sufijoOrden(orden.numero)}`
  let n = 1
  while (usados.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/* ─── Paso 1 · Despiece de materiales (oficina técnica) ───────── */

export interface LineaMaterial {
  subconjunto: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
}

/**
 * Carga el despiece. Reemplaza el anterior: si se vuelve a importar es porque
 * la estructura cambió, y conservar renglones viejos dejaría faltantes
 * fantasma. Se bloquea una vez que hay ingresos registrados, porque esos
 * renglones ya tienen material comprado contra ellos.
 */
export async function cargarMateriales(
  orden: OrdenProduccion,
  lineas: LineaMaterial[],
  origen: 'flexxus' | 'explosion' | 'manual',
  usuario: Usuario,
): Promise<number> {
  requireSector(usuario, 'oficina_tecnica')
  if (lineas.length === 0) throw new AuthError('El despiece no tiene renglones', 400)

  const recibidos = await db.query.recepcionesMaterial.findFirst({
    where: eq(recepcionesMaterial.ordenId, orden.id),
  })
  if (recibidos) {
    throw new AuthError(
      'Ya hay materiales ingresados contra este despiece: no se puede reemplazar. Corregí los renglones que haga falta.',
      409,
    )
  }

  await db.delete(materialesOrden).where(eq(materialesOrden.ordenId, orden.id))
  await db.insert(materialesOrden).values(
    lineas.map((l, i) => ({
      tenantId: orden.tenantId,
      ordenId: orden.id,
      proyectoId: orden.proyectoId,
      subconjunto: l.subconjunto.slice(0, 200),
      codigo: l.codigo.slice(0, 60),
      descripcion: l.descripcion.slice(0, 400),
      unidad: l.unidad.slice(0, 20),
      cantidadRequerida: l.cantidad,
      origen,
      orden: i,
    })),
  )

  await anotar(orden, usuario, 'oficina_tecnica', 'Despiece cargado', `${lineas.length} renglones (${origen})`)
  await sincronizarEtapa(orden, { notificar: true })
  return lineas.length
}

/* ─── Paso 2 · Verificación de stock (abastecimiento) ─────────── */

export interface VerificacionLinea {
  materialId: string
  cantidadDisponible: number
  nota?: string
}

/**
 * Abastecimiento dice, renglón por renglón, cuánto hay. No hay un "sí/no":
 * la disponibilidad parcial es el caso normal y de ahí sale cuánto comprar.
 */
export async function verificarStock(
  orden: OrdenProduccion,
  lineas: VerificacionLinea[],
  usuario: Usuario,
): Promise<{ disponibles: number; faltantes: number }> {
  requireSector(usuario, 'abastecimiento')
  if (lineas.length === 0) throw new AuthError('No hay renglones para verificar', 400)

  const ids = lineas.map((l) => l.materialId)
  const filas = await db.query.materialesOrden.findMany({
    where: and(eq(materialesOrden.ordenId, orden.id), inArray(materialesOrden.id, ids)),
  })
  const porId = new Map(filas.map((f) => [f.id, f]))
  if (filas.length !== new Set(ids).size) {
    throw new AuthError('Algún renglón no pertenece a esta orden', 404)
  }

  let disponibles = 0
  let faltantes = 0
  for (const linea of lineas) {
    const fila = porId.get(linea.materialId)
    if (!fila) continue
    const disp = Math.max(Number(linea.cantidadDisponible) || 0, 0)
    const alcanza = disp + fila.cantidadRecibida + EPS >= fila.cantidadRequerida
    if (alcanza) disponibles++
    else faltantes++
    await db
      .update(materialesOrden)
      .set({
        cantidadDisponible: disp,
        estado: alcanza ? 'disponible' : 'faltante',
        nota: (linea.nota ?? '').slice(0, 300),
      })
      .where(eq(materialesOrden.id, fila.id))
  }

  await anotar(
    orden, usuario, 'abastecimiento', 'Stock verificado',
    `${disponibles} renglones con stock, ${faltantes} con faltante`,
  )
  await sincronizarEtapa(orden, { notificar: true })
  return { disponibles, faltantes }
}

/* ─── Paso 3 · Orden de compra de referencia ──────────────────── */

export interface DatosOrdenCompra {
  materialIds?: string[]
  fechaNecesidad?: string
  proveedor?: string
  notas?: string
}

/**
 * Arma la OC de referencia con los faltantes. No es la OC del ERP: es el
 * pedido formal de esta obra, con la cantidad que falta de cada renglón, para
 * que compras lo gestione y el circuito pueda seguirlo.
 */
export async function emitirOrdenCompra(
  orden: OrdenProduccion,
  datos: DatosOrdenCompra,
  usuario: Usuario,
): Promise<OrdenCompra> {
  requireSector(usuario, 'abastecimiento')

  const fecha = (datos.fechaNecesidad ?? '').trim()
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new AuthError('La fecha de necesidad debe tener formato AAAA-MM-DD', 400)
  }

  const estado = await leerCircuito(orden.id)
  const yaPedido = new Map<string, number>()
  for (const oc of estado.ordenesCompra) {
    if (oc.estado === 'anulada') continue
    for (const it of oc.items) yaPedido.set(it.materialId, (yaPedido.get(it.materialId) ?? 0) + it.cantidad)
  }

  const elegidos = datos.materialIds?.length ? new Set(datos.materialIds) : null
  const renglones = estado.materiales
    .filter((m) => (elegidos ? elegidos.has(m.id) : m.estado === 'faltante'))
    .map((m) => {
      const necesita = Math.max(m.cantidadRequerida - m.cantidadDisponible - m.cantidadRecibida, 0)
      return { material: m, cantidad: Math.max(necesita - (yaPedido.get(m.id) ?? 0), 0) }
    })
    .filter((r) => r.cantidad > EPS)

  if (renglones.length === 0) {
    throw new AuthError('No hay faltantes pendientes de pedir', 400)
  }

  const numero = await proximoNumero('OC', orden, estado.ordenesCompra.map((o) => o.numero))
  const [oc] = await db
    .insert(ordenesCompra)
    .values({
      tenantId: orden.tenantId,
      ordenId: orden.id,
      proyectoId: orden.proyectoId,
      numero,
      fechaNecesidad: fecha,
      proveedor: (datos.proveedor ?? '').slice(0, 200),
      notas: (datos.notas ?? '').slice(0, 1000),
      emitidaPor: usuario.id,
    })
    .returning()

  await db.insert(ordenesCompraItems).values(
    renglones.map((r) => ({ ordenCompraId: oc.id, materialId: r.material.id, cantidad: r.cantidad })),
  )
  await db
    .update(materialesOrden)
    .set({ estado: 'pedido' })
    .where(inArray(materialesOrden.id, renglones.map((r) => r.material.id)))

  await anotar(orden, usuario, 'abastecimiento', `Orden de compra ${numero}`, `${renglones.length} renglones`)
  await sincronizarEtapa(orden, { notificar: true })
  return oc
}

/** Compras la gestionó en el ERP: queda pedida, con la referencia del ERP. */
export async function marcarOrdenCompraPedida(
  orden: OrdenProduccion,
  oc: OrdenCompra,
  referenciaErp: string,
  usuario: Usuario,
): Promise<void> {
  requireSector(usuario, 'abastecimiento')
  if (oc.estado !== 'borrador') throw new AuthError('La orden de compra ya fue cursada', 409)
  await db
    .update(ordenesCompra)
    .set({ estado: 'pedida', pedidaAt: new Date(), referenciaErp: referenciaErp.slice(0, 100) })
    .where(eq(ordenesCompra.id, oc.id))
  await anotar(orden, usuario, 'abastecimiento', `OC ${oc.numero} cursada`, referenciaErp)
  await sincronizarEtapa(orden, { notificar: true })
}

/* ─── Paso 4 · Ingreso de materiales ──────────────────────────── */

export interface DatosIngreso {
  materialId: string
  cantidad: number
  remitoProveedor?: string
  observaciones?: string
  ordenCompraId?: string | null
  documentoId?: string | null
}

/**
 * Registra un ingreso. Se acumula en vez de pisarse: los ingresos parciales
 * son la regla, no la excepción, y cada remito tiene que quedar.
 */
export async function registrarIngreso(
  orden: OrdenProduccion,
  datos: DatosIngreso,
  usuario: Usuario,
): Promise<MaterialOrden> {
  requireSector(usuario, 'abastecimiento')

  const cantidad = Number(datos.cantidad)
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new AuthError('La cantidad recibida tiene que ser mayor a cero', 400)
  }

  const material = await db.query.materialesOrden.findFirst({
    where: and(eq(materialesOrden.id, datos.materialId), eq(materialesOrden.ordenId, orden.id)),
  })
  if (!material) throw new AuthError('El material no pertenece a esta orden', 404)

  await db.insert(recepcionesMaterial).values({
    tenantId: orden.tenantId,
    ordenId: orden.id,
    materialId: material.id,
    ordenCompraId: datos.ordenCompraId ?? null,
    cantidad,
    remitoProveedor: (datos.remitoProveedor ?? '').slice(0, 100),
    observaciones: (datos.observaciones ?? '').slice(0, 500),
    documentoId: datos.documentoId ?? null,
    registradaPor: usuario.id,
  })

  const recibida = material.cantidadRecibida + cantidad
  const completo = material.cantidadDisponible + recibida + EPS >= material.cantidadRequerida
  const [actualizado] = await db
    .update(materialesOrden)
    .set({ cantidadRecibida: recibida, estado: completo ? 'recibido' : material.estado })
    .where(eq(materialesOrden.id, material.id))
    .returning()

  if (datos.ordenCompraId) await actualizarEstadoOc(datos.ordenCompraId, material.id, cantidad)

  await anotar(
    orden, usuario, 'abastecimiento', 'Ingreso de material',
    `${material.descripcion}: ${cantidad} ${material.unidad}`.trim(),
  )
  await sincronizarEtapa(orden, { notificar: true })
  return actualizado
}

async function actualizarEstadoOc(ocId: string, materialId: string, cantidad: number): Promise<void> {
  const oc = await db.query.ordenesCompra.findFirst({ where: eq(ordenesCompra.id, ocId), with: { items: true } })
  if (!oc) return

  const item = oc.items.find((i) => i.materialId === materialId)
  if (item) {
    await db
      .update(ordenesCompraItems)
      .set({ cantidadRecibida: item.cantidadRecibida + cantidad })
      .where(eq(ordenesCompraItems.id, item.id))
  }

  const items = oc.items.map((i) => (i.id === item?.id ? { ...i, cantidadRecibida: i.cantidadRecibida + cantidad } : i))
  const completa = items.every((i) => i.cantidadRecibida + EPS >= i.cantidad)
  const alguna = items.some((i) => i.cantidadRecibida > EPS)
  await db
    .update(ordenesCompra)
    .set({
      estado: completa ? 'recibida' : alguna ? 'recibida_parcial' : oc.estado,
      cerradaAt: completa ? new Date() : null,
    })
    .where(eq(ordenesCompra.id, oc.id))
}

/* ─── Paso 5 · Fabricación (taller) ───────────────────────────── */

/**
 * Define qué se fabrica. Por defecto, un renglón por subconjunto del despiece:
 * es como está organizada la estructura de producto y como trabaja el taller.
 */
export async function definirPartes(
  orden: OrdenProduccion,
  nombres: Array<{ nombre: string; cantidad?: number; unidad?: string }>,
  usuario: Usuario,
): Promise<number> {
  requireSector(usuario, 'oficina_tecnica')
  if (nombres.length === 0) throw new AuthError('No hay partes para definir', 400)

  const existentes = await db.query.partesFabricacion.findMany({ where: eq(partesFabricacion.ordenId, orden.id) })
  if (existentes.some((p) => p.estado !== 'pendiente' || p.cantidadDespachada > 0)) {
    throw new AuthError('El taller ya arrancó con estas partes: no se pueden reemplazar', 409)
  }

  await db.delete(partesFabricacion).where(eq(partesFabricacion.ordenId, orden.id))
  await db.insert(partesFabricacion).values(
    nombres.map((p, i) => ({
      tenantId: orden.tenantId,
      ordenId: orden.id,
      proyectoId: orden.proyectoId,
      nombre: p.nombre.slice(0, 200),
      cantidad: Number(p.cantidad) > 0 ? Number(p.cantidad) : 1,
      unidad: (p.unidad ?? 'un').slice(0, 20),
      orden: i,
    })),
  )

  await anotar(orden, usuario, 'oficina_tecnica', 'Partes definidas', `${nombres.length} partes`)
  await sincronizarEtapa(orden, { notificar: true })
  return nombres.length
}

/**
 * Avance del taller. No se puede empezar a fabricar con materiales sin
 * resolver: es la regla que evita que una parte arranque y quede a medias
 * esperando el acero.
 */
export async function actualizarParte(
  orden: OrdenProduccion,
  parteId: string,
  cambios: { estado?: ParteFabricacion['estado']; responsable?: string; notas?: string },
  usuario: Usuario,
): Promise<ParteFabricacion> {
  requireSector(usuario, 'taller')

  const parte = await db.query.partesFabricacion.findFirst({
    where: and(eq(partesFabricacion.id, parteId), eq(partesFabricacion.ordenId, orden.id)),
  })
  if (!parte) throw new AuthError('La parte no pertenece a esta orden', 404)

  const set: Partial<ParteFabricacion> = {}
  if (cambios.responsable !== undefined) set.responsable = cambios.responsable.slice(0, 200)
  if (cambios.notas !== undefined) set.notas = cambios.notas.slice(0, 1000)

  if (cambios.estado && cambios.estado !== parte.estado) {
    if (cambios.estado === 'en_proceso' || cambios.estado === 'terminada') {
      const estado = await leerCircuito(orden.id)
      const sinResolver = estado.materiales.filter(
        (m) => m.cantidadDisponible + m.cantidadRecibida + EPS < m.cantidadRequerida,
      )
      if (sinResolver.length > 0) {
        throw new AuthError(
          `Todavía hay ${sinResolver.length} renglones de material sin resolver: el taller no puede arrancar`,
          409,
        )
      }
    }
    set.estado = cambios.estado
    if (cambios.estado === 'en_proceso' && !parte.iniciadaAt) set.iniciadaAt = new Date()
    if (cambios.estado === 'terminada') set.terminadaAt = new Date()
  }

  const [actualizada] = await db
    .update(partesFabricacion)
    .set(set)
    .where(eq(partesFabricacion.id, parte.id))
    .returning()

  if (set.estado) {
    await anotar(orden, usuario, 'taller', `Parte ${ESTADO_PARTE[set.estado]}`, parte.nombre)
  }
  await sincronizarEtapa(orden, { notificar: true })
  return actualizada
}

const ESTADO_PARTE: Record<ParteFabricacion['estado'], string> = {
  pendiente: 'reabierta',
  en_proceso: 'en fabricación',
  terminada: 'terminada',
}

/* ─── Paso 6 · Despacho a obra (logística) ────────────────────── */

export interface DatosDespacho {
  items: Array<{ parteId?: string | null; descripcion?: string; cantidad: number; unidad?: string }>
  fechaSalida?: string
  transporte?: string
  chofer?: string
  patente?: string
  destino?: string
  observaciones?: string
}

/**
 * Arma el remito. Sólo se despacha lo que está terminado y todavía no salió:
 * sin eso, lo mismo se manda dos veces y la obra lo descubre en el campo.
 */
export async function crearDespacho(
  orden: OrdenProduccion,
  datos: DatosDespacho,
  usuario: Usuario,
): Promise<Despacho> {
  requireSector(usuario, 'logistica')

  const fecha = (datos.fechaSalida ?? '').trim()
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new AuthError('La fecha de salida debe tener formato AAAA-MM-DD', 400)
  }
  if (!datos.items?.length) throw new AuthError('El remito no tiene renglones', 400)

  const estado = await leerCircuito(orden.id)
  const porId = new Map(estado.partes.map((p) => [p.id, p]))

  const renglones = datos.items.map((it) => {
    const cantidad = Number(it.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new AuthError('Cada renglón del remito necesita una cantidad mayor a cero', 400)
    }
    if (it.parteId) {
      const parte = porId.get(it.parteId)
      if (!parte) throw new AuthError('Alguna parte no pertenece a esta orden', 404)
      if (parte.estado !== 'terminada') {
        throw new AuthError(`"${parte.nombre}" todavía no está terminada`, 409)
      }
      const disponible = parte.cantidad - parte.cantidadDespachada
      if (disponible <= EPS) {
        throw new AuthError(`"${parte.nombre}" ya se despachó por completo`, 409)
      }
      if (cantidad - disponible > EPS) {
        throw new AuthError(
          `De "${parte.nombre}" quedan ${disponible} ${parte.unidad} sin despachar`,
          409,
        )
      }
      return { parteId: parte.id, descripcion: parte.nombre, cantidad, unidad: parte.unidad }
    }
    const descripcion = (it.descripcion ?? '').trim()
    if (!descripcion) throw new AuthError('Cada renglón suelto necesita una descripción', 400)
    return { parteId: null, descripcion: descripcion.slice(0, 300), cantidad, unidad: (it.unidad ?? 'un').slice(0, 20) }
  })

  const numero = await proximoNumero('REM', orden, estado.despachos.map((d) => d.numero))
  const [despacho] = await db
    .insert(despachos)
    .values({
      tenantId: orden.tenantId,
      ordenId: orden.id,
      proyectoId: orden.proyectoId,
      numero,
      fechaSalida: fecha,
      transporte: (datos.transporte ?? '').slice(0, 200),
      chofer: (datos.chofer ?? '').slice(0, 200),
      patente: (datos.patente ?? '').slice(0, 20),
      destino: (datos.destino ?? '').slice(0, 300),
      observaciones: (datos.observaciones ?? '').slice(0, 1000),
      despachadoPor: usuario.id,
    })
    .returning()

  await db.insert(despachoItems).values(renglones.map((r) => ({ ...r, despachoId: despacho.id })))

  for (const r of renglones) {
    if (!r.parteId) continue
    const parte = porId.get(r.parteId)!
    await db
      .update(partesFabricacion)
      .set({ cantidadDespachada: parte.cantidadDespachada + r.cantidad })
      .where(eq(partesFabricacion.id, r.parteId))
  }

  await anotar(orden, usuario, 'logistica', `Remito ${numero} preparado`, `${renglones.length} renglones`)
  await sincronizarEtapa(orden, { notificar: true })
  return despacho
}

/** El camión salió. */
export async function marcarEnTransito(
  orden: OrdenProduccion,
  despacho: Despacho,
  usuario: Usuario,
): Promise<void> {
  requireSector(usuario, 'logistica')
  if (despacho.estado !== 'preparado') throw new AuthError('El despacho ya salió', 409)
  await db
    .update(despachos)
    .set({ estado: 'en_transito', despachadoAt: new Date() })
    .where(eq(despachos.id, despacho.id))
  await anotar(orden, usuario, 'logistica', `Remito ${despacho.numero} despachado`, despacho.destino)
  await sincronizarEtapa(orden, { notificar: true })
}

/* ─── Paso 7 · Control de llegada a obra ──────────────────────── */

export interface DatosRecepcionObra {
  recibidoPor: string
  conformidad: 'conforme' | 'con_observaciones' | 'rechazado'
  observaciones?: string
  documentoId?: string | null
  items?: Array<{ itemId: string; cantidadRecibida: number; observaciones?: string }>
}

/**
 * Control de llegada: quién recibió, cuándo y en qué estado. Un despacho no se
 * da por entregado hasta que alguien de la obra lo confirma — es el único
 * punto del circuito donde el dato lo aporta el destino y no el que despachó.
 */
export async function registrarRecepcionObra(
  orden: OrdenProduccion,
  despacho: Despacho,
  datos: DatosRecepcionObra,
  usuario: Usuario,
): Promise<void> {
  requireSector(usuario, 'logistica')
  if (despacho.estado === 'preparado') {
    throw new AuthError('El despacho todavía no salió del taller', 409)
  }
  if (despacho.recibidoAt) throw new AuthError('Este remito ya tiene su control de llegada', 409)

  const recibidoPor = (datos.recibidoPor ?? '').trim()
  if (!recibidoPor) throw new AuthError('Falta quién recibió en la obra', 400)
  if (!['conforme', 'con_observaciones', 'rechazado'].includes(datos.conformidad)) {
    throw new AuthError('Conformidad inválida', 400)
  }
  if (datos.conformidad !== 'conforme' && !(datos.observaciones ?? '').trim()) {
    throw new AuthError('Si no llegó conforme hay que decir qué pasó', 400)
  }

  const items = await db.query.despachoItems.findMany({ where: eq(despachoItems.despachoId, despacho.id) })
  const porId = new Map(items.map((i) => [i.id, i]))

  for (const linea of datos.items ?? []) {
    const item = porId.get(linea.itemId)
    if (!item) throw new AuthError('Algún renglón no pertenece a este remito', 404)
    const cantidad = Math.max(Number(linea.cantidadRecibida) || 0, 0)
    await db
      .update(despachoItems)
      .set({ cantidadRecibida: cantidad, observaciones: (linea.observaciones ?? '').slice(0, 300) })
      .where(eq(despachoItems.id, item.id))
  }
  // Sin detalle por renglón, llegó lo que salió.
  if (!datos.items?.length && datos.conformidad === 'conforme') {
    for (const item of items) {
      await db.update(despachoItems).set({ cantidadRecibida: item.cantidad }).where(eq(despachoItems.id, item.id))
    }
  }

  await db
    .update(despachos)
    .set({
      estado: datos.conformidad === 'rechazado' ? 'rechazado' : 'entregado',
      recibidoPor: recibidoPor.slice(0, 200),
      recibidoAt: new Date(),
      conformidad: datos.conformidad,
      observacionesObra: (datos.observaciones ?? '').slice(0, 1000),
      documentoId: datos.documentoId ?? null,
      registradoPor: usuario.id,
    })
    .where(eq(despachos.id, despacho.id))

  await anotar(
    orden, usuario, 'logistica', `Remito ${despacho.numero} recibido en obra`,
    `${recibidoPor} · ${datos.conformidad}${datos.observaciones ? ` · ${datos.observaciones}` : ''}`,
  )
  await sincronizarEtapa(orden, { notificar: true })
}

/* ─── Cierre ──────────────────────────────────────────────────── */

export async function cerrarOrden(orden: OrdenProduccion, usuario: Usuario): Promise<void> {
  requireSector(usuario, 'oficina_tecnica')
  const estado = await leerCircuito(orden.id)
  const etapa = etapaDerivada(estado, false)
  if (etapa !== 'obra') {
    throw new AuthError(`La obra está en "${tituloEtapa(etapa)}": todavía no se puede cerrar`, 409)
  }
  const pendientes = estado.despachos.filter((d) => d.estado !== 'entregado')
  if (pendientes.length > 0) {
    throw new AuthError(`Quedan ${pendientes.length} remitos sin confirmar en obra`, 409)
  }
  await db
    .update(ordenesProduccion)
    .set({ estado: 'cerrada', etapa: 'cerrada', etapaAt: new Date() })
    .where(eq(ordenesProduccion.id, orden.id))
  await anotar(orden, usuario, 'oficina_tecnica', 'Orden cerrada', '')
}
