import type { proyectos } from '@/db/schema'

// Capa de envío de email. Usa la API HTTP de Resend (sin dependencias extra).
// Si no está configurada (RESEND_API_KEY ausente), degrada con gracia: registra
// el email en consola y devuelve { sent: false } sin romper el flujo del negocio.

export interface EmailAdjunto {
  filename: string
  content: Buffer | string // Buffer o base64
}

export interface EmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: EmailAdjunto[]
}

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

// Dirección remitente (verificada en el proveedor). Configurable por env.
export function remitente(): string {
  return process.env.EMAIL_FROM || 'LOG METAL <no-reply@logmetal.com.ar>'
}

// Emails del equipo comercial que reciben los avisos internos.
export function equipoComercial(): string[] {
  const raw = process.env.EQUIPO_COMERCIAL_EMAILS || process.env.COMERCIAL_EMAIL || ''
  return raw.split(',').map((e) => e.trim()).filter(Boolean)
}

// URL base de la plataforma, para armar los links de los mails.
export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export interface EmailResultado {
  sent: boolean
  reason?: string
  id?: string
}

// Link a Google Calendar que crea una reunión (con enlace de Google Meet) con el
// cliente y el equipo comercial como invitados. Es liviano (sin dependencias de
// PDF) para poder usarse también desde componentes de servidor.
export function linkReunion(p: typeof proyectos.$inferSelect): string {
  const invitados = [p.email, ...equipoComercial()].filter(Boolean).join(',')
  const detalle = `Reunión para avanzar con el presupuesto ${p.codigo} de LOG METAL.\n` +
    `Cliente: ${p.cliente}${p.razonSocial ? ' (' + p.razonSocial + ')' : ''}.\n` +
    `Se generará un enlace de Google Meet al confirmar la invitación.`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reunión LOG METAL — ${p.codigo}`,
    details: detalle,
    add: invitados,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export async function enviarEmail(input: EmailInput): Promise<EmailResultado> {
  const destinatarios = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean)
  if (destinatarios.length === 0) return { sent: false, reason: 'sin destinatario' }

  if (!emailConfigurado()) {
    // Modo desarrollo / sin proveedor: dejamos traza y seguimos.
    console.info(`[email] (no enviado — RESEND_API_KEY ausente) → ${destinatarios.join(', ')} · ${input.subject}`)
    return { sent: false, reason: 'no configurado' }
  }

  const attachments = (input.attachments || []).map((a) => ({
    filename: a.filename,
    content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
  }))

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente(),
        to: destinatarios,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
        attachments: attachments.length ? attachments : undefined,
      }),
    })
    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      console.error(`[email] error ${res.status}: ${detalle}`)
      return { sent: false, reason: `proveedor ${res.status}` }
    }
    const data = await res.json().catch(() => ({}))
    return { sent: true, id: data?.id }
  } catch (err) {
    console.error('[email] excepción al enviar', err)
    return { sent: false, reason: 'excepción' }
  }
}
