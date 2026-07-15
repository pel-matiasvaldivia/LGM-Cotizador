import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appUrl, emailConfigurado, enviarEmail, equipoComercial, linkReunion, remitente } from './email'

const ORIG = { ...process.env }
afterEach(() => { process.env = { ...ORIG } })
beforeEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.EQUIPO_COMERCIAL_EMAILS
  delete process.env.COMERCIAL_EMAIL
  delete process.env.EMAIL_FROM
  delete process.env.APP_URL
})

const proyecto = {
  id: '00000000-0000-0000-0000-000000000001',
  codigo: 'PROY-2026-2912',
  cliente: 'Carlos Fernández',
  razonSocial: 'Metalúrgica del Oeste SRL',
  email: 'carlos@cliente.com',
  telefono: null,
  ubicacion: 'Mendoza',
  estado: 'enviado',
} as unknown as Parameters<typeof linkReunion>[0]

describe('configuración de email', () => {
  it('reporta no configurado sin RESEND_API_KEY', () => {
    expect(emailConfigurado()).toBe(false)
  })
  it('reporta configurado con RESEND_API_KEY', () => {
    process.env.RESEND_API_KEY = 're_test'
    expect(emailConfigurado()).toBe(true)
  })
  it('parsea la lista del equipo comercial', () => {
    process.env.EQUIPO_COMERCIAL_EMAILS = 'a@x.com, b@x.com ,'
    expect(equipoComercial()).toEqual(['a@x.com', 'b@x.com'])
  })
  it('usa COMERCIAL_EMAIL como respaldo', () => {
    process.env.COMERCIAL_EMAIL = 'solo@x.com'
    expect(equipoComercial()).toEqual(['solo@x.com'])
  })
  it('remitente por defecto y override', () => {
    expect(remitente()).toContain('LOG METAL')
    process.env.EMAIL_FROM = 'X <x@y.com>'
    expect(remitente()).toBe('X <x@y.com>')
  })
  it('appUrl sin barra final', () => {
    process.env.APP_URL = 'https://app.test/'
    expect(appUrl()).toBe('https://app.test')
  })
})

describe('enviarEmail — degradación', () => {
  it('no envía sin proveedor configurado', async () => {
    const r = await enviarEmail({ to: 'x@y.com', subject: 's', html: '<p>h</p>' })
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('no configurado')
  })
  it('no envía sin destinatario', async () => {
    process.env.RESEND_API_KEY = 're_test'
    const r = await enviarEmail({ to: '', subject: 's', html: '<p>h</p>' })
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('sin destinatario')
  })
})

describe('linkReunion', () => {
  it('arma un link de Google Calendar con los invitados', () => {
    process.env.EQUIPO_COMERCIAL_EMAILS = 'comercial@logmetal.com.ar'
    const url = linkReunion(proyecto)
    expect(url).toContain('calendar.google.com/calendar/render')
    expect(url).toContain('action=TEMPLATE')
    const add = decodeURIComponent(new URL(url).searchParams.get('add') || '')
    expect(add).toContain('carlos@cliente.com')
    expect(add).toContain('comercial@logmetal.com.ar')
    expect(decodeURIComponent(new URL(url).searchParams.get('text') || '')).toContain('PROY-2026-2912')
  })
})
