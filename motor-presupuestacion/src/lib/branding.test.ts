import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brandCssVars, getBrandArchivo, resetBrandCache } from './branding'

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

describe('branding', () => {
  it('sin BRAND usa la marca neutra, sin identidad de nadie', () => {
    const b = getBrandArchivo()
    expect(b.slug).toBe('default')
    expect(b.nombre).toBe('Tu Empresa')
    expect(b.logo).toBeNull()
    expect(b.theme.primary).toBe('#2563eb')
    // Las secciones que dependen de datos del tenant arrancan vacías.
    expect(b.clientes.logos).toEqual([])
    expect(b.nosotros.stats).toEqual([])
    expect(b.contacto.whatsapp).toBe('')
  })

  it('carga el preset del repo con BRAND', () => {
    process.env.BRAND = 'logmetal'
    const b = getBrandArchivo()
    expect(b.nombre).toBe('Log Metal')
    expect(b.razonSocial).toBe('Log Metal SRL')
    expect(b.logo).toBe('/logo.png')
    expect(b.theme.primary).toBe('#f05a28')
    expect(b.theme.ink).toBe('#1b2a47')
    expect(b.nosotros.stats).toHaveLength(3)
    expect(b.clientes.logos).toContain('TOYOTA')
    // Lo que el preset no define sale de la marca base.
    expect(b.servicios.items).toHaveLength(3)
  })

  it('las variables de entorno pisan al preset', () => {
    process.env.BRAND = 'logmetal'
    process.env.BRAND_NOMBRE = 'Acero Sur'
    process.env.BRAND_COLOR_PRIMARY = '#0E9F6E'
    const b = getBrandArchivo()
    expect(b.nombre).toBe('Acero Sur')
    expect(b.theme.primary).toBe('#0e9f6e')
    // Lo no pisado sigue viniendo del preset.
    expect(b.theme.ink).toBe('#1b2a47')
  })

  it('un JSON externo mergea profundo y reemplaza los arrays enteros', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'brand-'))
    const archivo = path.join(dir, 'marca.json')
    writeFileSync(archivo, JSON.stringify({
      nombre: 'Externa',
      contacto: { email: 'ventas@externa.test' },
      clientes: { logos: ['UNO'] },
    }))

    process.env.BRAND = 'logmetal'
    process.env.BRAND_CONFIG_FILE = archivo
    const b = getBrandArchivo()

    expect(b.nombre).toBe('Externa')
    expect(b.contacto.email).toBe('ventas@externa.test')
    // El resto del bloque contacto no se pierde en el merge.
    expect(b.contacto.telefono).toBe('+54 9 261 XXX-XXXX')
    // Un array se reemplaza, no se concatena: si el tenant pide 1 logo, va 1.
    expect(b.clientes.logos).toEqual(['UNO'])
  })

  it('descarta colores y rutas de imagen que no son válidos', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.BRAND_COLOR_PRIMARY = 'red; background:url(javascript:alert(1))'
    process.env.BRAND_LOGO = 'javascript:alert(1)'
    const b = getBrandArchivo()
    expect(b.theme.primary).toBe('#2563eb')
    expect(b.logo).toBeNull()
  })

  it('ignora un BRAND que intente salirse del directorio de presets', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.BRAND = '../../etc/passwd'
    expect(getBrandArchivo().nombre).toBe('Tu Empresa')
  })

  it('acota el alto del logo a un rango razonable', () => {
    process.env.BRAND_LOGO_ALTO = '900'
    expect(getBrandArchivo().logoAlto).toBe(48)
  })

  it('brandCssVars expone los tres colores base', () => {
    process.env.BRAND = 'logmetal'
    const css = brandCssVars(getBrandArchivo())
    expect(css).toContain('--brand-primary:#f05a28')
    expect(css).toContain('--brand-ink:#1b2a47')
    expect(css).toContain('--brand-surface:#f4f5f7')
  })
})
