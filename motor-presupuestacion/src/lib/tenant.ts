// Multi-tenant por dominio. Cada request se resuelve a una empresa mirando el
// Host, y de esa fila sale la marca (logo, paleta, textos) y los datos fiscales
// que se imprimen en el presupuesto.
//
// El aislamiento de datos cuelga de acá: todas las consultas de proyectos,
// catálogo, precios y parámetros filtran por el tenant que devuelve getTenant().

import { cache } from 'react'
import { headers } from 'next/headers'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { tenantDominios, tenants, type Tenant } from '@/db/schema'
import { AuthError } from '@/lib/errors'
import { brandDesdeTenant, getBrandArchivo, getBrandNeutro, type Brand } from '@/lib/branding'

/**
 * Normaliza un Host a la forma en que se guardan los dominios: minúsculas, sin
 * puerto y sin `www.`, para que `WWW.Acme.com:3000` matchee con `acme.com`.
 */
export function normalizarDominio(host: string | null | undefined): string {
  if (!host) return ''
  let h = host.trim().toLowerCase()
  if (h.startsWith('[')) {
    // IPv6 entre corchetes: [::1]:3000
    h = h.slice(1, h.indexOf(']') > 0 ? h.indexOf(']') : undefined)
  } else {
    const dosPuntos = h.lastIndexOf(':')
    if (dosPuntos > 0 && /^\d+$/.test(h.slice(dosPuntos + 1))) h = h.slice(0, dosPuntos)
  }
  return h.replace(/^www\./, '')
}

/** Host del request, contemplando el reverse proxy que va adelante en producción. */
export async function dominioDelRequest(): Promise<string> {
  const h = await headers()
  return normalizarDominio(h.get('x-forwarded-host') || h.get('host'))
}

/**
 * Empresa del request, o null si el dominio no está asignado a ninguna.
 *
 * Cacheado por request (React `cache`), así resolverlo en el layout, en la
 * página y en cada consulta cuesta una sola query. Leer headers() hace que la
 * ruta se renderice en runtime, que es justo lo que queremos: la misma imagen
 * sirve a todos los dominios.
 */
export const getTenant = cache(async (): Promise<Tenant | null> => {
  const dominio = await dominioDelRequest()

  if (dominio) {
    const fila = await db.query.tenantDominios.findFirst({
      where: eq(tenantDominios.dominio, dominio),
      with: { tenant: true },
    })
    if (fila?.tenant && fila.tenant.activo) return fila.tenant
  }

  // Respaldo 1: un slug fijado por entorno (útil en desarrollo y detrás de
  // proxies que no reenvían el Host).
  const slug = (process.env.TENANT_DEFAULT || '').trim()
  if (slug) {
    const porSlug = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
    if (porSlug?.activo) return porSlug
  }

  // Respaldo 2: si hay una sola empresa en la base, es esa. Un despliegue de un
  // solo cliente no necesita configurar dominios.
  const todos = await db.query.tenants.findMany({ orderBy: asc(tenants.createdAt), limit: 2 })
  if (todos.length === 1 && todos[0].activo) return todos[0]

  return null
})

/**
 * Empresa por id. Para trabajos que no cuelgan del Host del request (mails,
 * PDFs en segundo plano): la identidad sale del dueño del dato, no del dominio
 * por el que entró la llamada.
 */
export const getTenantPorId = cache(async (id: string): Promise<Tenant | null> => {
  const fila = await db.query.tenants.findFirst({ where: eq(tenants.id, id) })
  return fila ?? null
})

/** Igual que getTenant(), pero falla con 404 si el dominio no está asignado. */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await getTenant()
  if (!tenant) {
    throw new AuthError('Este dominio no está asignado a ninguna empresa', 404)
  }
  return tenant
}

/**
 * Marca activa: la fila del tenant sobre los defaults de la config de archivo.
 * Las páginas la piden una vez y la bajan por props.
 */
export const getBrandActual = cache(async (): Promise<Brand> => {
  const tenant = await getTenant()
  // Dominio sin asignar: marca neutra. Nunca la de otra empresa ni la del
  // preset de archivo — un host apuntado al servidor por error no puede
  // terminar mostrando la identidad de un cliente.
  return tenant ? brandDesdeTenant(tenant) : getBrandNeutro()
})

/** Marca de un tenant puntual (para trabajos fuera del ciclo de request). */
export function getBrandDeTenant(tenant: Tenant | null): Brand {
  return brandDesdeTenant(tenant)
}

export { getBrandArchivo }
