import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brandDesdeTenant, getBrandNeutro, resetBrandCache } from './branding'
import { normalizarDominio } from './tenant'
import { emisorDesdeTenant } from './pdf-emisor'
import type { Tenant } from '@/db/schema'

const ORIG = { ...process.env }

beforeEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k === 'BRAND' || k.startsWith('BRAND_')) delete process.env[k]
  }
  resetBrandCache()
})

afterEach(() => {
  process.env = { ...ORIG }
  resetBrandCache()
  vi.restoreAllMocks()
})

// Fila de empresa como la devuelve la base, con lo mínimo poblado.
function tenant(patch: Partial<Tenant> = {}): Tenant {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'acero-sur',
    activo: true,
    nombre: 'Acero Sur',
    razonSocial: 'Acero Sur S.A.',
    tagline: 'NAVES INDUSTRIALES',
    cuit: '30-71234567-4',
    condicionIva: 'Responsable Inscripto',
    ingresosBrutos: 'CM 901-123456-7',
    inicioActividades: '01/03/1998',
    domicilio: 'Parque Industrial Oeste 450',
    localidad: 'Neuquén',
    provincia: 'Neuquén',
    codigoPostal: 'Q8300',
    telefono: '+54 299 123-4567',
    email: 'ventas@acerosur.test',
    web: 'www.acerosur.test',
    whatsapp: '5492991234567',
    colorPrimario: '#0e9f6e',
    colorInk: '#12263f',
    colorSurface: '',
    logoMime: null,
    logoBase64: null,
    logoOscuroMime: null,
    logoOscuroBase64: null,
    logoAlto: 44,
    landing: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
    ...patch,
  } as Tenant
}

describe('normalizarDominio', () => {
  it('saca el puerto, el www y la caja', () => {
    expect(normalizarDominio('WWW.Acme.COM:3000')).toBe('acme.com')
    expect(normalizarDominio('acme.com')).toBe('acme.com')
    expect(normalizarDominio('sub.acme.com:443')).toBe('sub.acme.com')
    expect(normalizarDominio('[::1]:3000')).toBe('::1')
    expect(normalizarDominio(null)).toBe('')
  })
})

describe('brandDesdeTenant', () => {
  it('toma la identidad de la fila de la empresa', () => {
    const b = brandDesdeTenant(tenant())
    expect(b.slug).toBe('acero-sur')
    expect(b.nombre).toBe('Acero Sur')
    expect(b.razonSocial).toBe('Acero Sur S.A.')
    expect(b.theme.primary).toBe('#0e9f6e')
    expect(b.contacto.email).toBe('ventas@acerosur.test')
    expect(b.fiscal.cuit).toBe('30-71234567-4')
  })

  it('un color vacío cae al default, un texto vacío queda vacío', () => {
    const b = brandDesdeTenant(tenant({ colorSurface: '', whatsapp: '' }))
    // Sin color configurado se usa el neutro, no se rompe la paleta.
    expect(b.theme.surface).toBe(getBrandNeutro().theme.surface)
    // Un WhatsApp borrado a propósito tiene que seguir borrado (oculta el botón).
    expect(b.contacto.whatsapp).toBe('')
  })

  it('arma el domicilio para mostrar cuando la landing no lo define', () => {
    const b = brandDesdeTenant(tenant())
    expect(b.contacto.direccion).toBe('Parque Industrial Oeste 450, Neuquén, Neuquén')
  })

  it('los textos de la landing pisan los defaults y el resto se conserva', () => {
    const b = brandDesdeTenant(tenant({
      landing: { hero: { badge: 'Fabricantes desde 1998' }, clientes: { logos: ['AGROSUR'] } },
    }))
    expect(b.hero.badge).toBe('Fabricantes desde 1998')
    expect(b.hero.cta).toBe(getBrandNeutro().hero.cta)
    expect(b.clientes.logos).toEqual(['AGROSUR'])
  })

  it('NO hereda la identidad del preset de archivo del despliegue', () => {
    // Dos empresas en el mismo contenedor: la segunda no puede quedarse con el
    // logo ni los textos de la primera sólo porque BRAND apunte a su preset.
    process.env.BRAND = 'logmetal'
    resetBrandCache()
    const b = brandDesdeTenant(tenant())
    expect(b.logo).toBeNull()
    expect(b.nosotros.texto).not.toContain('Log Metal')
    expect(b.clientes.logos).toEqual([])
  })

  it('el logo cargado se sirve desde la base, con el slug y la versión', () => {
    const b = brandDesdeTenant(tenant({ logoMime: 'image/png', logoBase64: 'AAAA' }))
    expect(b.logo).toBe(`/api/brand/logo?t=acero-sur&v=${new Date('2026-09-01T12:00:00Z').getTime()}`)
    // Con logo propio claro no se hereda un oscuro ajeno.
    expect(b.logoOscuro).toBeNull()
  })

  it('sin empresa (dominio sin asignar) devuelve la config de archivo', () => {
    process.env.BRAND = 'logmetal'
    resetBrandCache()
    expect(brandDesdeTenant(null).nombre).toBe('Log Metal')
  })
})

describe('emisorDesdeTenant', () => {
  it('lleva los datos fiscales y el domicilio con código postal al PDF', () => {
    const t = tenant()
    const e = emisorDesdeTenant(t, brandDesdeTenant(t))
    expect(e.razonSocial).toBe('Acero Sur S.A.')
    expect(e.cuit).toBe('30-71234567-4')
    expect(e.condicionIva).toBe('Responsable Inscripto')
    expect(e.ingresosBrutos).toBe('CM 901-123456-7')
    expect(e.inicioActividades).toBe('01/03/1998')
    expect(e.domicilio).toBe('(Q8300) Parque Industrial Oeste 450, Neuquén, Neuquén')
    expect(e.colorAcento).toBe('#0e9f6e')
  })

  it('incrusta el logo PNG de la empresa', () => {
    const t = tenant({ logoMime: 'image/png', logoBase64: 'QUJD' })
    const e = emisorDesdeTenant(t, brandDesdeTenant(t))
    expect(e.logo).toBe('data:image/png;base64,QUJD')
  })

  it('un logo SVG no se incrusta: el PDF cae al texto de la razón social', () => {
    const t = tenant({ logoMime: 'image/svg+xml', logoBase64: 'PHN2Zy8+' })
    const e = emisorDesdeTenant(t, brandDesdeTenant(t))
    expect(e.logo).toBeNull()
  })

  it('sin empresa usa la config de archivo (instalación de un solo cliente)', () => {
    process.env.BRAND = 'logmetal'
    resetBrandCache()
    const e = emisorDesdeTenant(null, brandDesdeTenant(null))
    expect(e.razonSocial).toBe('Log Metal SRL')
  })
})
