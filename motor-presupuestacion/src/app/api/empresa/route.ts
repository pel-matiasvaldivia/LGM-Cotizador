import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tenants } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { requireTenant } from '@/lib/tenant'

// Datos de la empresa del dominio (Configuración → Empresa). Lo que se guarda
// acá es lo que ve el visitante en la landing y lo que sale impreso en el
// presupuesto: identidad, datos fiscales, domicilio, contacto y logos.
//
// Los dominios NO se editan desde acá: son configuración de plataforma
// (scripts/tenant.mjs), para que una empresa no pueda apropiarse de un host.

const TEXTOS = [
  'nombre', 'razonSocial', 'tagline',
  'cuit', 'condicionIva', 'ingresosBrutos', 'inicioActividades',
  'domicilio', 'localidad', 'provincia', 'codigoPostal',
  'telefono', 'email', 'web', 'whatsapp',
  'colorPrimario', 'colorInk', 'colorSurface',
] as const

const LARGO_MAX = 200
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
// Imágenes que sirven para la web y para el PDF. El SVG se acepta para el sitio
// (en el PDF, una empresa con logo SVG cae a su razón social en texto).
const MIMES_LOGO = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_LOGO_BYTES = 512 * 1024

function limpiar(valor: unknown): string {
  return String(valor ?? '').trim().slice(0, LARGO_MAX)
}

export const GET = withErrorHandling(async () => {
  await requireUser(['admin', 'comercial'])
  const t = await requireTenant()

  return NextResponse.json({
    empresa: {
      slug: t.slug,
      nombre: t.nombre,
      razonSocial: t.razonSocial,
      tagline: t.tagline,
      cuit: t.cuit,
      condicionIva: t.condicionIva,
      ingresosBrutos: t.ingresosBrutos,
      inicioActividades: t.inicioActividades,
      domicilio: t.domicilio,
      localidad: t.localidad,
      provincia: t.provincia,
      codigoPostal: t.codigoPostal,
      telefono: t.telefono,
      email: t.email,
      web: t.web,
      whatsapp: t.whatsapp,
      colorPrimario: t.colorPrimario,
      colorInk: t.colorInk,
      colorSurface: t.colorSurface,
      logoAlto: t.logoAlto,
      tieneLogo: Boolean(t.logoBase64),
      tieneLogoOscuro: Boolean(t.logoOscuroBase64),
      landing: t.landing ?? {},
      actualizado: t.updatedAt.toISOString(),
    },
  })
})

export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['admin'])
  const tenant = await requireTenant()
  const body = await req.json().catch(() => ({}))

  const cambios: Partial<typeof tenants.$inferInsert> = {}

  for (const campo of TEXTOS) {
    if (body[campo] === undefined) continue
    const valor = limpiar(body[campo])
    if (campo.startsWith('color') && valor && !HEX.test(valor)) {
      return NextResponse.json({ error: `${campo} debe ser un color hex (#rrggbb)` }, { status: 400 })
    }
    cambios[campo] = valor
  }

  // El nombre es lo único que no puede quedar vacío: es el wordmark de fallback.
  if (cambios.nombre !== undefined && !cambios.nombre) {
    return NextResponse.json({ error: 'El nombre de la empresa es obligatorio' }, { status: 400 })
  }

  if (body.logoAlto !== undefined) {
    const alto = Number(body.logoAlto)
    if (!Number.isFinite(alto) || alto < 16 || alto > 160) {
      return NextResponse.json({ error: 'El alto del logo debe estar entre 16 y 160 px' }, { status: 400 })
    }
    cambios.logoAlto = Math.round(alto)
  }

  // Logos: `{ mime, base64 }` para reemplazar, null para borrar, ausente para
  // dejar el que está.
  for (const [clave, campoMime, campoBase64] of [
    ['logo', 'logoMime', 'logoBase64'],
    ['logoOscuro', 'logoOscuroMime', 'logoOscuroBase64'],
  ] as const) {
    if (body[clave] === undefined) continue
    if (body[clave] === null) {
      cambios[campoMime] = null
      cambios[campoBase64] = null
      continue
    }
    const mime = String(body[clave]?.mime || '')
    const base64 = String(body[clave]?.base64 || '')
    if (!MIMES_LOGO.includes(mime)) {
      return NextResponse.json({ error: 'El logo debe ser PNG, JPG, WEBP o SVG' }, { status: 400 })
    }
    if (!base64 || Buffer.byteLength(base64, 'base64') > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'El logo debe pesar menos de 512 KB' }, { status: 400 })
    }
    cambios[campoMime] = mime
    cambios[campoBase64] = base64
  }

  // Textos de la landing: se guardan tal cual (objeto parcial); la marca los
  // mergea sobre los defaults al renderizar.
  if (body.landing !== undefined) {
    if (typeof body.landing !== 'object' || body.landing === null || Array.isArray(body.landing)) {
      return NextResponse.json({ error: 'landing debe ser un objeto' }, { status: 400 })
    }
    cambios.landing = body.landing
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  cambios.updatedAt = sql`now()` as unknown as Date
  await db.update(tenants).set(cambios).where(eq(tenants.id, tenant.id))

  return NextResponse.json({ success: true })
})
