// Datos del emisor del presupuesto: la empresa que cotiza. Salen de la fila del
// tenant (Configuración → Empresa) y son lo que el cliente ve impreso en el
// R-04: razón social, CUIT, domicilio, contacto y datos fiscales.
//
// El PDF no puede resolver variables CSS ni pedir una imagen por HTTP, así que
// acá se materializa todo: colores en hex y logo en base64.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Brand } from '@/lib/branding'
import type { Tenant } from '@/db/schema'

export interface EmisorPDF {
  nombre: string
  razonSocial: string
  tagline: string
  cuit: string
  condicionIva: string
  ingresosBrutos: string
  inicioActividades: string
  /** Domicilio en una línea, listo para imprimir. */
  domicilio: string
  telefono: string
  email: string
  web: string
  colorMarca: string
  colorAcento: string
  /** Logo listo para incrustar; react-pdf sólo admite PNG y JPG. */
  logo: string | null
}

const MIME_PDF: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

// Logo del preset de archivo (public/...), para las empresas que todavía no
// cargaron el suyo desde el panel.
function logoDeArchivo(ruta: string | null): string | null {
  if (!ruta || !ruta.startsWith('/') || ruta.startsWith('/api/')) return null
  const mime = MIME_PDF[path.extname(ruta).toLowerCase()]
  if (!mime) return null
  try {
    const abs = path.join(process.cwd(), 'public', ruta.replace(/^\//, ''))
    return `data:${mime};base64,${readFileSync(abs).toString('base64')}`
  } catch {
    return null
  }
}

function logoDelTenant(tenant: Tenant | null): string | null {
  if (!tenant?.logoBase64) return null
  const mime = tenant.logoMime || 'image/png'
  // Un SVG no se puede incrustar en el PDF: se cae al texto de la razón social.
  if (!Object.values(MIME_PDF).includes(mime)) return null
  return `data:${mime};base64,${tenant.logoBase64}`
}

export function emisorDesdeTenant(tenant: Tenant | null, brand: Brand): EmisorPDF {
  const cp = brand.contacto.codigoPostal ? `(${brand.contacto.codigoPostal}) ` : ''
  const domicilio = brand.contacto.domicilio
    ? [cp + brand.contacto.domicilio, brand.contacto.localidad, brand.contacto.provincia]
        .map((x) => (x || '').trim())
        .filter(Boolean)
        .join(', ')
    : brand.contacto.direccion

  return {
    nombre: brand.nombre,
    razonSocial: brand.razonSocial || brand.nombre,
    tagline: brand.tagline,
    cuit: brand.fiscal.cuit,
    condicionIva: brand.fiscal.condicionIva,
    ingresosBrutos: brand.fiscal.ingresosBrutos,
    inicioActividades: brand.fiscal.inicioActividades,
    domicilio,
    telefono: brand.contacto.telefono,
    email: brand.contacto.email,
    web: brand.contacto.web,
    colorMarca: brand.theme.ink,
    colorAcento: brand.theme.primary,
    logo: logoDelTenant(tenant) ?? logoDeArchivo(brand.logo),
  }
}
