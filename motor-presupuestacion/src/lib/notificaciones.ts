import type { proyectos } from '@/db/schema'
import { appUrl, enviarEmail, equipoComercial, linkReunion, type EmailAdjunto, type EmailResultado } from '@/lib/email'
import { construirR04 } from '@/lib/pdf-r04'

export { linkReunion }

type Proyecto = typeof proyectos.$inferSelect

const MARCA = '#1B2A47'
const ACENTO = '#F05A28'

// Envoltorio HTML común de los mails (branding LOG METAL, estilos inline para
// compatibilidad con clientes de correo).
function plantilla(titulo: string, cuerpo: string, cta?: { label: string; url: string }): string {
  const boton = cta
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${cta.url}" style="display:inline-block;background:${ACENTO};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;">${cta.label}</a>
       </td></tr>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${MARCA};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(27,42,71,.08);">
        <tr><td style="background:${MARCA};padding:22px 32px;">
          <span style="font-weight:800;font-size:20px;letter-spacing:-.5px;color:#fff;">LOG<span style="color:${ACENTO};">METAL</span></span>
          <span style="font-size:10px;letter-spacing:3px;color:#9fb0cc;margin-left:8px;">NAVES INDUSTRIALES</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${MARCA};">${titulo}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6;color:#4a5568;">
            ${cuerpo}
            ${boton}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #eef0f3;font-size:12px;color:#8a93a3;">
          LOG METAL · Naves Industriales — Este es un mensaje automático del sistema de cotizaciones.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function fila(html: string): string {
  return `<tr><td style="padding:0 0 14px;">${html}</td></tr>`
}

function datosProyecto(p: Proyecto): string {
  const linea = (k: string, v: string | null | undefined) =>
    v ? `<div style="padding:2px 0;"><span style="color:#8a93a3;">${k}:</span> <strong style="color:${MARCA};">${v}</strong></div>` : ''
  return `<tr><td style="padding:4px 0 16px;">
    <div style="background:#f8fafc;border:1px solid #eef0f3;border-radius:12px;padding:14px 16px;font-size:14px;">
      ${linea('Presupuesto', p.codigo)}
      ${linea('Cliente', p.cliente)}
      ${linea('Empresa', p.razonSocial)}
      ${linea('Ubicación', p.ubicacion)}
      ${linea('Email', p.email)}
      ${linea('Teléfono', p.telefono)}
    </div></td></tr>`
}

// Ejecuta un envío sin propagar errores: las notificaciones nunca deben romper
// la operación de negocio que las dispara.
async function seguro(fn: () => Promise<EmailResultado>): Promise<EmailResultado> {
  try {
    return await fn()
  } catch (err) {
    console.error('[notificaciones] fallo al enviar', err)
    return { sent: false, reason: 'excepción' }
  }
}

// 1) El cliente registró su consulta: bienvenida + aviso al equipo comercial.
export async function notificarConsultaRecibida(p: Proyecto): Promise<void> {
  const portal = `${appUrl()}/mi-proyecto`

  // Bienvenida al cliente
  if (p.email) {
    await seguro(() => enviarEmail({
      to: p.email!,
      subject: `Recibimos tu consulta — ${p.codigo}`,
      html: plantilla(
        `¡Bienvenido/a al proceso de cotización, ${primerNombre(p.cliente)}!`,
        fila(`Recibimos tu consulta correctamente. Nuestro equipo comercial preparará tu <strong>cotización formal</strong> y te la enviará a la brevedad.`) +
        fila(`Tu presupuesto quedó registrado con el código <strong>${p.codigo}</strong>. Podés seguir el estado en cualquier momento desde tu portal.`) +
        datosProyecto(p),
        { label: 'Ver mi proyecto', url: portal },
      ),
    }))
  }

  // Aviso al equipo comercial
  const equipo = equipoComercial()
  if (equipo.length) {
    await seguro(() => enviarEmail({
      to: equipo,
      subject: `Nueva cotización ${p.codigo} — a la espera de revisión`,
      html: plantilla(
        `Nueva cotización de ${p.cliente}`,
        fila(`El cliente <strong>${p.cliente}</strong> creó la cotización <strong>${p.codigo}</strong> desde el canal Web y está <strong>a la espera de tu revisión</strong>.`) +
        datosProyecto(p),
        { label: 'Revisar el proyecto', url: `${appUrl()}/proyectos/${p.id}` },
      ),
      replyTo: p.email || undefined,
    }))
  }
}

// 2) El comercial envió el presupuesto: mail al cliente con link + PDF adjunto.
export async function notificarPresupuestoEnviado(p: Proyecto): Promise<void> {
  if (!p.email) return
  const portal = `${appUrl()}/mi-proyecto`

  let adjuntos: EmailAdjunto[] | undefined
  try {
    const r04 = await construirR04(p.id)
    if (r04) adjuntos = [{ filename: r04.filename, content: r04.buffer }]
  } catch (err) {
    console.error('[notificaciones] no se pudo adjuntar el PDF', err)
  }

  await seguro(() => enviarEmail({
    to: p.email!,
    subject: `Tu presupuesto ${p.codigo} está listo`,
    html: plantilla(
      `Tu presupuesto ya está disponible`,
      fila(`Hola ${primerNombre(p.cliente)}, preparamos la cotización formal de tu proyecto <strong>${p.codigo}</strong>.`) +
      fila(`Podés verla e iniciar sesión en la plataforma con tu email, o abrir el <strong>PDF adjunto</strong> a este correo.`) +
      fila(`Para avanzar, ingresá a tu portal y <strong>pre-aprobá la oferta</strong>: coordinamos una reunión por Google Meet con tu asesor comercial.`),
      { label: 'Ver mi presupuesto', url: portal },
    ),
    attachments: adjuntos,
  }))
}

// 3) El cliente pre-aprobó: dispara la reunión (mail al equipo con link de Meet)
//    y confirma al cliente.
export async function notificarPreaprobacion(p: Proyecto): Promise<void> {
  const reunion = linkReunion(p)

  const equipo = equipoComercial()
  if (equipo.length) {
    await seguro(() => enviarEmail({
      to: equipo,
      subject: `Preaprobación ${p.codigo} — coordinar reunión`,
      html: plantilla(
        `${p.cliente} pre-aprobó la oferta`,
        fila(`El cliente <strong>${p.cliente}</strong> pre-aprobó el presupuesto <strong>${p.codigo}</strong> y quiere avanzar.`) +
        fila(`Agendá la reunión: se creará un evento en Google Calendar con enlace de <strong>Google Meet</strong>, con el cliente como invitado.`) +
        datosProyecto(p),
        { label: 'Agendar reunión (Google Meet)', url: reunion },
      ),
      replyTo: p.email || undefined,
    }))
  }

  if (p.email) {
    await seguro(() => enviarEmail({
      to: p.email!,
      subject: `Recibimos tu pre-aprobación — ${p.codigo}`,
      html: plantilla(
        `¡Gracias! Coordinamos la reunión`,
        fila(`Registramos la pre-aprobación de tu presupuesto <strong>${p.codigo}</strong>.`) +
        fila(`Tu asesor comercial se pondrá en contacto para confirmar el día y la hora. También podés agendar la reunión por <strong>Google Meet</strong> con el botón de abajo.`),
        { label: 'Agendar reunión (Google Meet)', url: reunion },
      ),
    }))
  }
}

function primerNombre(nombre: string | null): string {
  return (nombre || '').trim().split(/\s+/)[0] || 'cliente'
}
