// Operaciones de plataforma: dar de alta una empresa del servicio, asignarle
// dominios, sembrarle el catálogo y crearle su primer admin. Es lo que usa la
// pantalla Plataforma (y las rutas /api/admin/*), siempre detrás de
// requireSuperadmin().
//
// `scripts/tenant.mjs` hace lo mismo por línea de comandos como vía de rescate
// (cuando el panel no está disponible o todavía no hay ningún superadmin): la
// lógica de semilla está duplicada a propósito en los dos lados, así que si
// cambia una hay que actualizar la otra.

import { and, asc, eq, sql } from 'drizzle-orm'
import { db, getPool } from '@/db'
import { proyectos, rubros, tenantDominios, tenants, usuarios, type Tenant } from '@/db/schema'
import { AuthError } from '@/lib/errors'
import { hashPassword } from '@/lib/password'
// La semilla (parámetros + copia del catálogo) vive en un módulo compartido con
// los scripts de operaciones: es la misma implementación para el panel y para
// la consola. Ver scripts/lib/semilla.mjs.
import { enTransaccion, sembrarEmpresa as sembrarConQuery } from '../../scripts/lib/semilla.mjs'
import type { ResultadoSemilla } from '../../scripts/lib/semilla.mjs'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/
const DOMINIO_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface EmpresaResumen {
  id: string
  slug: string
  nombre: string
  razonSocial: string
  cuit: string
  activo: boolean
  tieneLogo: boolean
  colorPrimario: string
  dominios: string[]
  usuarios: number
  proyectos: number
  rubros: number
  creada: string
}

/** Normaliza un dominio a como se guarda: minúsculas, sin puerto ni `www.`. */
export function normalizarDominioIngresado(valor: string): string {
  let d = String(valor || '').trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  d = d.replace(/:\d+$/, '').replace(/^www\./, '')
  return d
}

export function validarSlug(slug: string): string {
  const s = String(slug || '').trim().toLowerCase()
  if (!SLUG_RE.test(s)) {
    throw new AuthError('El identificador debe ser minúsculas, números y guiones (2 a 41 caracteres)', 400)
  }
  return s
}

export function validarDominio(valor: string): string {
  const d = normalizarDominioIngresado(valor)
  if (!DOMINIO_RE.test(d) || d.length > 253) {
    throw new AuthError(`"${valor}" no parece un dominio válido`, 400)
  }
  return d
}

// Cuántas filas tiene cada empresa en una tabla, en una sola consulta.
async function contarPorTenant(
  tabla: typeof usuarios | typeof proyectos | typeof rubros,
): Promise<Map<string, number>> {
  const filas = await db
    .select({ tenantId: tabla.tenantId, n: sql<number>`count(*)::int` })
    .from(tabla)
    .groupBy(tabla.tenantId)
  return new Map(filas.map((f) => [f.tenantId, Number(f.n)]))
}

/** Empresas con sus dominios y unas métricas para el listado. */
export async function listarEmpresas(): Promise<EmpresaResumen[]> {
  const [filas, dominios, nUsuarios, nProyectos, nRubros] = await Promise.all([
    db.select().from(tenants).orderBy(asc(tenants.createdAt)),
    db.select().from(tenantDominios).orderBy(asc(tenantDominios.dominio)),
    contarPorTenant(usuarios),
    contarPorTenant(proyectos),
    contarPorTenant(rubros),
  ])

  return filas.map((f) => ({
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    razonSocial: f.razonSocial,
    cuit: f.cuit,
    activo: f.activo,
    tieneLogo: Boolean(f.logoBase64),
    colorPrimario: f.colorPrimario,
    dominios: dominios.filter((d) => d.tenantId === f.id).map((d) => d.dominio),
    usuarios: nUsuarios.get(f.id) ?? 0,
    proyectos: nProyectos.get(f.id) ?? 0,
    rubros: nRubros.get(f.id) ?? 0,
    creada: f.createdAt.toISOString(),
  }))
}

export async function buscarEmpresa(id: string): Promise<Tenant> {
  const fila = await db.query.tenants.findFirst({ where: eq(tenants.id, id) })
  if (!fila) throw new AuthError('Empresa no encontrada', 404)
  return fila
}

export async function crearEmpresa(entrada: {
  slug: string
  nombre: string
  dominios?: string[]
}): Promise<Tenant> {
  const slug = validarSlug(entrada.slug)
  const nombre = String(entrada.nombre || '').trim().slice(0, 200)
  if (!nombre) throw new AuthError('Falta el nombre de la empresa', 400)

  const dominios = (entrada.dominios ?? []).map(validarDominio)

  const existente = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
  if (existente) throw new AuthError(`Ya existe una empresa con el identificador "${slug}"`, 409)

  const [tenant] = await db.insert(tenants).values({ slug, nombre }).returning()
  for (const dominio of dominios) {
    await asignarDominio(tenant.id, dominio)
  }
  return tenant
}

/**
 * Asigna un dominio a una empresa. Un dominio pertenece a una sola empresa: si
 * ya estaba tomado se lo mueve, y se informa de dónde salió para que el cambio
 * no sea silencioso.
 */
export async function asignarDominio(tenantId: string, valor: string): Promise<{ dominio: string; movidoDe?: string }> {
  const dominio = validarDominio(valor)
  const tenant = await buscarEmpresa(tenantId)

  const previo = await db.query.tenantDominios.findFirst({
    where: eq(tenantDominios.dominio, dominio),
    with: { tenant: true },
  })
  if (previo && previo.tenantId === tenant.id) return { dominio }

  await db
    .insert(tenantDominios)
    .values({ dominio, tenantId: tenant.id })
    .onConflictDoUpdate({ target: tenantDominios.dominio, set: { tenantId: tenant.id } })

  return { dominio, movidoDe: previo?.tenant?.slug }
}

export async function quitarDominio(tenantId: string, valor: string): Promise<void> {
  const dominio = normalizarDominioIngresado(valor)
  const borrados = await db
    .delete(tenantDominios)
    .where(and(eq(tenantDominios.dominio, dominio), eq(tenantDominios.tenantId, tenantId)))
    .returning({ dominio: tenantDominios.dominio })
  if (borrados.length === 0) throw new AuthError('Ese dominio no está asignado a esta empresa', 404)
}

export async function actualizarEmpresa(
  tenantId: string,
  cambios: { nombre?: string; activo?: boolean },
): Promise<void> {
  const set: { nombre?: string; activo?: boolean; updatedAt?: Date } = {}
  if (cambios.nombre !== undefined) {
    const nombre = String(cambios.nombre).trim().slice(0, 200)
    if (!nombre) throw new AuthError('El nombre no puede quedar vacío', 400)
    set.nombre = nombre
  }
  if (cambios.activo !== undefined) set.activo = Boolean(cambios.activo)
  if (Object.keys(set).length === 0) throw new AuthError('Nada para actualizar', 400)

  set.updatedAt = sql`now()` as unknown as Date
  await db.update(tenants).set(set).where(eq(tenants.id, tenantId))
}

/**
 * Valida email y contraseña de un usuario nuevo. Se expone aparte para poder
 * chequearlos ANTES de crear la empresa en el alta guiada: si no, una
 * contraseña corta dejaba la empresa creada y sin admin.
 */
export function validarCredenciales(email: unknown, password: unknown): string {
  const limpio = String(email || '').toLowerCase().trim()
  if (!EMAIL_RE.test(limpio)) throw new AuthError('Email inválido', 400)
  if (String(password || '').length < 8) {
    throw new AuthError('La contraseña debe tener al menos 8 caracteres', 400)
  }
  return limpio
}

/** Alta de un usuario en una empresa (típicamente su primer admin). */
export async function crearUsuarioDeEmpresa(
  tenantId: string,
  entrada: { email: string; password: string; nombre?: string; rol?: 'admin' | 'comercial' },
): Promise<{ id: string; email: string }> {
  await buscarEmpresa(tenantId)

  const email = validarCredenciales(entrada.email, entrada.password)
  const rol = entrada.rol === 'comercial' ? 'comercial' : 'admin'

  const duplicado = await db.query.usuarios.findFirst({
    where: and(eq(usuarios.tenantId, tenantId), eq(usuarios.email, email)),
  })
  if (duplicado) throw new AuthError('Esa empresa ya tiene un usuario con ese email', 409)

  const [user] = await db
    .insert(usuarios)
    .values({
      tenantId,
      email,
      nombre: String(entrada.nombre || '').trim() || 'Administrador',
      rol,
      passwordHash: await hashPassword(entrada.password),
    })
    .returning({ id: usuarios.id, email: usuarios.email })
  return user
}

/**
 * Deja a una empresa nueva en condiciones de cotizar: parámetros de costeo por
 * defecto y un catálogo de rubros/ratios copiado de otra empresa como plantilla
 * (después cada una ajusta sus propios costos).
 *
 * Es idempotente: si ya tiene catálogo, no lo toca. La lógica es la compartida
 * con scripts/tenant.mjs; acá sólo se valida y se abre la transacción.
 */
export async function sembrarEmpresa(
  tenantId: string,
  opciones: { plantillaId?: string } = {},
): Promise<ResultadoSemilla> {
  await buscarEmpresa(tenantId)
  // Si se pide una plantilla puntual, que exista es parte de la validación de
  // la request (404), no un detalle de la semilla.
  if (opciones.plantillaId) await buscarEmpresa(opciones.plantillaId)

  return enTransaccion(getPool(), (query) =>
    sembrarConQuery(query, tenantId, { plantillaId: opciones.plantillaId }),
  )
}

/**
 * Borra una empresa con TODO lo suyo (usuarios, proyectos, catálogo, precios,
 * parámetros: cuelgan por ON DELETE CASCADE). No tiene vuelta atrás, así que
 * exige que quien lo pide repita el identificador, y nadie puede borrar la
 * empresa por la que está entrando.
 */
export async function borrarEmpresa(
  tenantId: string,
  opciones: { confirmacion: string; tenantPropioId: string },
): Promise<{ slug: string }> {
  const tenant = await buscarEmpresa(tenantId)

  if (tenant.id === opciones.tenantPropioId) {
    throw new AuthError('No podés borrar la empresa por la que estás entrando', 400)
  }
  if (String(opciones.confirmacion || '').trim() !== tenant.slug) {
    throw new AuthError(`Para borrarla hay que escribir su identificador: ${tenant.slug}`, 400)
  }

  await db.delete(tenants).where(eq(tenants.id, tenantId))
  return { slug: tenant.slug }
}
