// Marca blanca (white label). Toda la identidad visible del sitio público
// —nombre, logo, paleta, textos y datos de la empresa— sale de acá y NO del
// código de las páginas. Así el mismo build sirve a cualquier empresa que
// contrate el servicio.
//
// La fuente de verdad en producción es la fila del tenant en la base, que cada
// empresa edita desde Configuración → Empresa (ver brandDesdeTenant()). Este
// módulo aporta los DEFAULTS sobre los que se apoya esa fila: alcanza para
// arrancar una instalación nueva, sirve de respaldo si el dominio todavía no
// está asignado, y es de dónde sale el bootstrap del primer tenant.
//
// Resolución de los defaults de archivo, de menor a mayor prioridad:
//   1. marca neutra de base (más abajo, no es la identidad de nadie)
//   2. `config/brands/<BRAND>.json`  (preset versionado en el repo)
//   3. `BRAND_CONFIG_FILE`           (JSON externo, ideal para montar por volumen)
//   4. Variables de entorno `BRAND_*` (overrides puntuales)
//
// Los JSON son parciales: solo definen lo que cambian. El merge es profundo.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Tenant } from '@/db/schema'

/* ─── Tipos ──────────────────────────────────────────────────── */

export interface BrandTheme {
  /** Color de acento (botones, links, destacados). Hex. */
  primary: string
  /** Color institucional oscuro (títulos, secciones oscuras). Hex. */
  ink: string
  /** Gris de fondo de las secciones alternadas. Hex. */
  surface: string
}

export interface BrandServicio {
  /** Clave de ícono: factory | building | layers | wrench | hammer | ruler | truck | shield */
  icono: string
  titulo: string
  desc: string
  items: string[]
}

export interface BrandStat {
  num: string
  label: string
}

export interface Brand {
  slug: string
  /** Nombre comercial corto, usado como wordmark si no hay logo. */
  nombre: string
  /** Razón social, usada en el copyright. */
  razonSocial: string
  /** Bajada corta del rubro; aparece junto al logo en mails y PDFs. */
  tagline: string
  /** Ruta pública del logo (ej: /brand/acme.svg) o null para usar el nombre como texto. */
  logo: string | null
  /** Logo alternativo para fondos oscuros (footer). Si es null se usa `logo`. */
  logoOscuro: string | null
  /** Alto del logo en el header, en px. Los logos apaisados y los cuadrados no comparten escala. */
  logoAlto: number
  theme: BrandTheme
  meta: { title: string; description: string }
  hero: {
    badge: string
    tituloLinea1: string
    tituloDestacado: string
    subtitulo: string
    cta: string
    notaCta: string
  }
  servicios: {
    eyebrow: string
    titulo: string
    subtitulo: string
    items: BrandServicio[]
  }
  nosotros: {
    eyebrow: string
    titulo: string
    texto: string
    stats: BrandStat[]
    /** Imagen institucional; null muestra el placeholder. */
    imagen: string | null
  }
  clientes: {
    titulo: string
    /** Nombres de clientes. Lista vacía oculta la sección entera. */
    logos: string[]
  }
  contacto: {
    eyebrow: string
    titulo: string
    subtitulo: string
    /** Domicilio para mostrar; si no se define, se arma con domicilio + localidad + provincia. */
    direccion: string
    telefono: string
    email: string
    /** Número en formato internacional sin signos (ej: 5492611234567). Vacío oculta el botón. */
    whatsapp: string
    web: string
    /** Domicilio desglosado (lo que va en el presupuesto). */
    domicilio: string
    localidad: string
    provincia: string
    codigoPostal: string
  }
  /** Datos fiscales del emisor: encabezado y pie del presupuesto. */
  fiscal: {
    cuit: string
    condicionIva: string
    ingresosBrutos: string
    inicioActividades: string
  }
  ctaFinal: { titulo: string; subtitulo: string; boton: string }
  /** Se agrega al copyright del footer: "© 2026 Razón Social · <footerNota>". */
  footerNota: string
}

/* ─── Marca neutra de base ───────────────────────────────────── */
// Sin esto, un JSON de marca incompleto dejaría huecos en la página. Es la
// red de contención: genérica a propósito, no es la identidad de nadie.

const BRAND_BASE: Brand = {
  slug: 'default',
  nombre: 'Tu Empresa',
  razonSocial: 'Tu Empresa S.A.',
  tagline: 'NAVES INDUSTRIALES',
  logo: null,
  logoOscuro: null,
  logoAlto: 48,
  theme: {
    primary: '#2563EB',
    ink: '#1E293B',
    surface: '#F4F5F7',
  },
  meta: {
    title: 'Estructuras Metálicas Industriales',
    description:
      'Diseño, ingeniería, fabricación y montaje de naves industriales. Cotizá tu proyecto en minutos.',
  },
  hero: {
    badge: 'Construcción industrial',
    tituloLinea1: 'Construimos',
    tituloDestacado: 'tu espacio.',
    subtitulo:
      'Diseño, ingeniería, fabricación y montaje de naves industriales. Cotizá tu proyecto en minutos.',
    cta: 'Cotizar proyecto',
    notaCta: 'Sin compromiso · Resultado en 2 minutos',
  },
  servicios: {
    eyebrow: 'Servicios',
    titulo: 'Lo que hacemos',
    subtitulo:
      'Soluciones integrales de infraestructura metálica para cualquier escala y sector.',
    items: [
      {
        icono: 'factory',
        titulo: 'Naves Industriales',
        desc: 'Sistemas Alveolar, Alma Llena y Reticulado. Rápido montaje, grandes luces sin columnas intermedias.',
        items: ['Sistema Kit económico', 'Sin soldaduras en obra', 'Grandes luces libres'],
      },
      {
        icono: 'building',
        titulo: 'Edificios Corporativos',
        desc: 'Arquitectura metálica moderna para oficinas y espacios comerciales de vanguardia.',
        items: ['Diseño arquitectónico', 'Estructura sismo-resistente', 'Llave en mano'],
      },
      {
        icono: 'layers',
        titulo: 'Soluciones Modulares',
        desc: 'Unidades transportables y modulares de rápida implantación. Habitacional y comercial.',
        items: ['Rápida instalación', 'Bajo mantenimiento', 'Alta durabilidad'],
      },
    ],
  },
  nosotros: {
    eyebrow: 'Nosotros',
    titulo: 'Ingeniería que respalda tu inversión',
    texto:
      'Ofrecemos servicios integrales desde el diseño y la ingeniería, hasta la fabricación, montaje y ejecución llave en mano.',
    stats: [],
    imagen: null,
  },
  clientes: {
    titulo: 'Empresas que confían en nosotros',
    logos: [],
  },
  contacto: {
    eyebrow: 'Contacto',
    titulo: 'Hablemos de tu proyecto',
    subtitulo:
      'Completá el formulario o contactanos directamente. Respondemos en menos de 24 horas.',
    direccion: '',
    telefono: '',
    email: '',
    whatsapp: '',
    web: '',
    domicilio: '',
    localidad: '',
    provincia: '',
    codigoPostal: '',
  },
  fiscal: {
    cuit: '',
    condicionIva: '',
    ingresosBrutos: '',
    inicioActividades: '',
  },
  ctaFinal: {
    titulo: '¿Listo para construir?',
    subtitulo: 'Usá nuestro cotizador inteligente y recibí un presupuesto detallado en minutos.',
    boton: 'Cotizar proyecto',
  },
  footerNota: '',
}

/* ─── Merge y saneado ────────────────────────────────────────── */

type Json = Record<string, unknown>

// Merge profundo de objetos planos. Los arrays se reemplazan enteros (no se
// concatenan): si una marca define 2 servicios, quiere 2, no 5.
function merge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base
  if (Array.isArray(base) || Array.isArray(patch)) return patch as T
  if (typeof base !== 'object' || typeof patch !== 'object') return patch as T

  const out: Json = { ...(base as Json) }
  for (const [k, v] of Object.entries(patch as Json)) {
    if (v === undefined) continue
    out[k] = k in (base as Json) ? merge((base as Json)[k], v) : v
  }
  return out as T
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

// Los colores terminan dentro de un `<style>`: solo hex, nada de funciones ni
// de texto arbitrario que pueda escapar de la declaración.
function color(valor: unknown, fallback: string): string {
  const v = typeof valor === 'string' ? valor.trim() : ''
  if (HEX.test(v)) return v.toLowerCase()
  if (v) console.warn(`[branding] color inválido "${v}", se usa ${fallback}`)
  return fallback.toLowerCase()
}

// El logo va a un `src`: ruta pública propia o URL https, nada más.
function asset(valor: unknown): string | null {
  const v = typeof valor === 'string' ? valor.trim() : ''
  if (!v) return null
  if (v.startsWith('/') && !v.startsWith('//')) return v
  if (v.startsWith('https://')) return v
  console.warn(`[branding] ruta de imagen inválida "${v}", se ignora`)
  return null
}

function sanear(b: Brand): Brand {
  const alto = Number(b.logoAlto)
  return {
    ...b,
    logo: asset(b.logo),
    logoOscuro: asset(b.logoOscuro),
    logoAlto: Number.isFinite(alto) && alto >= 16 && alto <= 160 ? Math.round(alto) : 48,
    theme: {
      primary: color(b.theme?.primary, BRAND_BASE.theme.primary),
      ink: color(b.theme?.ink, BRAND_BASE.theme.ink),
      surface: color(b.theme?.surface, BRAND_BASE.theme.surface),
    },
    nosotros: { ...b.nosotros, imagen: asset(b.nosotros?.imagen) },
  }
}

/* ─── Carga ──────────────────────────────────────────────────── */

function leerJson(ruta: string, obligatorio: boolean): Json | null {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8')) as Json
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (obligatorio) console.warn(`[branding] no se pudo leer ${ruta}: ${msg}`)
    return null
  }
}

function preset(slug: string): Json | null {
  // El slug llega por env y se usa para armar una ruta: solo lo alfanumérico.
  if (!/^[a-z0-9._-]+$/i.test(slug)) {
    console.warn(`[branding] BRAND="${slug}" inválido, se ignora`)
    return null
  }
  const dir = process.env.BRAND_CONFIG_DIR || path.join(process.cwd(), 'config', 'brands')
  return leerJson(path.join(dir, `${slug}.json`), slug !== 'default')
}

// Overrides sueltos por entorno: lo mínimo para levantar un tenant sin tocar
// archivos (el resto sale del preset o del BRAND_CONFIG_FILE).
function overridesEnv(): Json {
  const env = process.env
  const patch: Json = {}
  const set = (obj: Json, clave: string, valor: string | undefined) => {
    if (valor !== undefined && valor !== '') obj[clave] = valor
  }

  set(patch, 'nombre', env.BRAND_NOMBRE)
  set(patch, 'razonSocial', env.BRAND_RAZON_SOCIAL)
  set(patch, 'tagline', env.BRAND_TAGLINE)
  set(patch, 'logo', env.BRAND_LOGO)
  set(patch, 'logoOscuro', env.BRAND_LOGO_OSCURO)
  set(patch, 'footerNota', env.BRAND_FOOTER_NOTA)
  if (env.BRAND_LOGO_ALTO) patch.logoAlto = Number(env.BRAND_LOGO_ALTO)

  const theme: Json = {}
  set(theme, 'primary', env.BRAND_COLOR_PRIMARY)
  set(theme, 'ink', env.BRAND_COLOR_INK)
  set(theme, 'surface', env.BRAND_COLOR_SURFACE)
  if (Object.keys(theme).length) patch.theme = theme

  const contacto: Json = {}
  set(contacto, 'direccion', env.BRAND_DIRECCION)
  set(contacto, 'telefono', env.BRAND_TELEFONO)
  set(contacto, 'email', env.BRAND_EMAIL)
  set(contacto, 'whatsapp', env.BRAND_WHATSAPP)
  set(contacto, 'web', env.BRAND_WEB)
  set(contacto, 'domicilio', env.BRAND_DOMICILIO)
  set(contacto, 'localidad', env.BRAND_LOCALIDAD)
  set(contacto, 'provincia', env.BRAND_PROVINCIA)
  set(contacto, 'codigoPostal', env.BRAND_CODIGO_POSTAL)
  if (Object.keys(contacto).length) patch.contacto = contacto

  const fiscal: Json = {}
  set(fiscal, 'cuit', env.BRAND_CUIT)
  set(fiscal, 'condicionIva', env.BRAND_CONDICION_IVA)
  set(fiscal, 'ingresosBrutos', env.BRAND_INGRESOS_BRUTOS)
  set(fiscal, 'inicioActividades', env.BRAND_INICIO_ACTIVIDADES)
  if (Object.keys(fiscal).length) patch.fiscal = fiscal

  const meta: Json = {}
  set(meta, 'title', env.BRAND_META_TITLE)
  set(meta, 'description', env.BRAND_META_DESCRIPTION)
  if (Object.keys(meta).length) patch.meta = meta

  return patch
}

let cache: Brand | null = null

/**
 * Defaults de archivo del despliegue. Se resuelven una sola vez por proceso.
 * En una instalación multi-tenant esto NO es la marca que ve el visitante:
 * para eso está getBrandActual() en src/lib/tenant.ts, que apoya la fila del
 * tenant sobre estos valores.
 */
export function getBrandArchivo(): Brand {
  if (cache) return cache

  const slug = (process.env.BRAND || 'default').trim() || 'default'
  let brand = merge(BRAND_BASE, preset('default'))
  if (slug !== 'default') brand = merge(brand, preset(slug))

  const externo = process.env.BRAND_CONFIG_FILE
  if (externo) brand = merge(brand, leerJson(externo, true))

  brand = merge(brand, overridesEnv())
  cache = sanear({ ...brand, slug })
  return cache
}

/**
 * Defaults neutros, sin nada de la config de archivo: es la base de la marca de
 * un tenant. Importa que NO incluya el preset del despliegue, porque si no una
 * empresa nueva heredaría los textos y el logo de la primera que se configuró.
 */
export function getBrandNeutro(): Brand {
  return sanear(merge(BRAND_BASE, {}))
}

/** Solo para tests: fuerza una nueva lectura de la config. */
export function resetBrandCache(): void {
  cache = null
}

/* ─── Marca de un tenant ─────────────────────────────────────── */

// Un texto que la empresa dejó vacío no debe reponerse con el default: si el
// admin borró el WhatsApp, el botón tiene que desaparecer. Los colores son la
// excepción (vacío = "usá el default", no "sin color").
function siDefinido(valor: string | null | undefined, fallback: string): string {
  return typeof valor === 'string' ? valor : fallback
}

/**
 * Marca de una empresa: su fila de la base sobre los defaults de archivo.
 *
 * - `landing` (jsonb) mergea profundo sobre los textos por defecto, así una
 *   empresa que no escribió nada igual muestra una landing coherente.
 * - los escalares que administra el panel (nombre, contacto, fiscales, logo,
 *   colores) los manda la base.
 * - sin tenant (dominio sin asignar) devuelve los defaults de archivo.
 */
export function brandDesdeTenant(tenant: Tenant | null): Brand {
  // Sin tenant (dominio sin asignar) se muestra la config de archivo, que es lo
  // único que hay. Con tenant, todo sale de la base sobre defaults neutros.
  if (!tenant) return getBrandArchivo()

  const base = getBrandNeutro()
  const conLanding = merge(base, (tenant.landing ?? {}) as Json)

  const domicilioCompleto = [tenant.domicilio, tenant.localidad, tenant.provincia]
    .map((x) => (x || '').trim())
    .filter(Boolean)
    .join(', ')

  // El logo cargado se sirve desde la base por /api/brand/logo; `v` es el
  // updatedAt para que el navegador no se quede con el anterior. Si la empresa
  // no subió ninguno, queda el de la config de archivo (o el wordmark).
  const version = tenant.updatedAt instanceof Date ? tenant.updatedAt.getTime() : Date.now()
  const slug = encodeURIComponent(tenant.slug)
  const logo = tenant.logoBase64
    ? `/api/brand/logo?t=${slug}&v=${version}`
    : conLanding.logo // ruta pública que la empresa haya dejado en su landing
  const logoOscuro = tenant.logoOscuroBase64
    ? `/api/brand/logo?variante=oscuro&t=${slug}&v=${version}`
    : tenant.logoBase64
      ? null // con logo propio claro, no mezclar con el oscuro heredado
      : conLanding.logoOscuro

  const brand: Brand = {
    ...conLanding,
    slug: tenant.slug,
    nombre: tenant.nombre || base.nombre,
    razonSocial: tenant.razonSocial || tenant.nombre || base.razonSocial,
    tagline: siDefinido(tenant.tagline, base.tagline),
    logo,
    logoOscuro,
    logoAlto: tenant.logoAlto,
    theme: {
      primary: color(tenant.colorPrimario, conLanding.theme.primary),
      ink: color(tenant.colorInk, conLanding.theme.ink),
      surface: color(tenant.colorSurface, conLanding.theme.surface),
    },
    contacto: {
      ...conLanding.contacto,
      direccion: conLanding.contacto.direccion || domicilioCompleto,
      telefono: siDefinido(tenant.telefono, conLanding.contacto.telefono),
      email: siDefinido(tenant.email, conLanding.contacto.email),
      whatsapp: siDefinido(tenant.whatsapp, conLanding.contacto.whatsapp),
      web: siDefinido(tenant.web, conLanding.contacto.web),
      domicilio: siDefinido(tenant.domicilio, conLanding.contacto.domicilio),
      localidad: siDefinido(tenant.localidad, conLanding.contacto.localidad),
      provincia: siDefinido(tenant.provincia, conLanding.contacto.provincia),
      codigoPostal: siDefinido(tenant.codigoPostal, conLanding.contacto.codigoPostal),
    },
    fiscal: {
      cuit: siDefinido(tenant.cuit, conLanding.fiscal.cuit),
      condicionIva: siDefinido(tenant.condicionIva, conLanding.fiscal.condicionIva),
      ingresosBrutos: siDefinido(tenant.ingresosBrutos, conLanding.fiscal.ingresosBrutos),
      inicioActividades: siDefinido(tenant.inicioActividades, conLanding.fiscal.inicioActividades),
    },
  }

  // El saneado vuelve a correr sobre lo que vino de la base: un color o una
  // ruta inválida guardada a mano no puede llegar al HTML.
  return sanear(brand)
}

/**
 * Variables CSS que derivan de la marca. Se inyectan en `:root` y todas las
 * utilidades `*-brand*` de Tailwind las consumen (ver globals.css).
 */
export function brandCssVars(brand: Brand): string {
  const { primary, ink, surface } = brand.theme
  return [
    `--brand-primary:${primary}`,
    `--brand-ink:${ink}`,
    `--brand-surface:${surface}`,
  ].join(';')
}
