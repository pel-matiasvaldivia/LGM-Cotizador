import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/db'
import { documentosProyecto } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireProyecto } from '@/lib/scope'
import { exigirVerificado } from '@/lib/verificacion'
import { AuthError } from '@/lib/errors'
import { getTenantPorId } from '@/lib/tenant'
import { brandDesdeTenant } from '@/lib/branding'
import { emisorDesdeTenant } from '@/lib/pdf-emisor'
import { generarContratoPDF } from '@/lib/pdf-cierre'
import {
  emitirContrato, firmarContrato, getContrato, normalizarCondiciones,
} from '@/lib/cierre'
import { contratoToRow } from '@/lib/serializers'
import { notificarContratoEmitido, notificarContratoFirmado } from '@/lib/notificaciones'

// Contrato de obra: se emite cuando el comercial cierra la venta (después de la
// reunión con el cliente) y se firma digitalmente desde el portal del cliente o
// en papel, subiendo el escaneo.
//
//   POST   → emitir / reemitir el contrato (staff)
//   PATCH  → registrar la firma (el cliente firma digital; el staff, en papel)
//   GET    → PDF del contrato

const MAX_FIRMADO_BYTES = 8 * 1024 * 1024

function esStaff(rol: string): boolean {
  return rol === 'comercial' || rol === 'admin'
}

/** El contrato es "suyo" si el email del proyecto es el de la cuenta. */
function esSuyo(emailProyecto: string | null, emailUsuario: string): boolean {
  return Boolean(emailProyecto) && emailProyecto!.toLowerCase() === emailUsuario.toLowerCase()
}

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await requireProyecto(body.proyectoId)
  const condiciones = normalizarCondiciones(body)
  const contrato = await emitirContrato(proyecto, condiciones, user.id)

  await notificarContratoEmitido({ ...proyecto, estado: 'contrato' }, contrato)

  return NextResponse.json({ success: true, contrato: contratoToRow(contrato) })
})

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser()

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await requireProyecto(body.proyectoId)
  const contrato = await getContrato(proyecto.id)
  if (!contrato) {
    return NextResponse.json({ error: 'No hay contrato emitido' }, { status: 404 })
  }

  const staff = esStaff(user.rol)

  if (!staff) {
    // El cliente firma el suyo, y sólo si confirmó su email: la firma vale por
    // la identidad de la cuenta, así que esa identidad tiene que estar probada.
    exigirVerificado(user)
    if (!esSuyo(proyecto.email, user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (body.aceptaCondiciones !== true) {
      return NextResponse.json({ error: 'Hay que aceptar las condiciones del contrato' }, { status: 400 })
    }

    // Trazabilidad de la firma digital: qué cuenta, desde dónde y con qué
    // navegador. La IP se guarda hasheada (alcanza para cotejar, no expone el
    // dato personal en un documento que después circula).
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || ''
    const agente = (req.headers.get('user-agent') || '').slice(0, 120)
    const huella = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : 'sin-ip'

    const firmado = await firmarContrato(contrato, {
      metodo: 'digital',
      nombre: String(body.nombre || user.nombre || proyecto.cliente),
      email: user.email,
      referencia: `cuenta ${user.email} · ip:${huella} · ${agente}`,
    })

    await notificarContratoFirmado({ ...proyecto, estado: 'aprobado' }, firmado)
    return NextResponse.json({ success: true, contrato: contratoToRow(firmado) })
  }

  // Firma en papel: el staff sube el contrato escaneado. Sin el archivo no se
  // da por firmado: el respaldo es el documento, no la palabra de quien clickea.
  const archivo = body.archivo as { nombre?: string; tipoMime?: string; base64?: string } | undefined
  if (!archivo?.base64) {
    return NextResponse.json(
      { error: 'Para registrar la firma en papel hay que adjuntar el contrato escaneado' },
      { status: 400 },
    )
  }
  if (Buffer.byteLength(archivo.base64, 'base64') > MAX_FIRMADO_BYTES) {
    return NextResponse.json({ error: 'El archivo debe pesar menos de 8 MB' }, { status: 400 })
  }

  const nombreArchivo = String(archivo.nombre || `Contrato-firmado-${contrato.numero}.pdf`).slice(0, 200)

  const [documento] = await db.insert(documentosProyecto).values({
    proyectoId: proyecto.id,
    nombre: nombreArchivo,
    tipoMime: String(archivo.tipoMime || 'application/pdf').slice(0, 100),
    tamanoBytes: Buffer.byteLength(archivo.base64, 'base64'),
    contenidoBase64: archivo.base64,
  }).returning()

  const firmado = await firmarContrato(contrato, {
    metodo: 'manual',
    nombre: String(body.nombre || proyecto.razonSocial || proyecto.cliente),
    email: proyecto.email || '',
    referencia: `firma en papel · archivo ${nombreArchivo} (${documento.id})`,
  })

  await notificarContratoFirmado({ ...proyecto, estado: 'aprobado' }, firmado)

  return NextResponse.json({ success: true, contrato: contratoToRow(firmado), documentoId: documento.id })
})

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser()

  const proyectoId = new URL(req.url).searchParams.get('proyectoId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await requireProyecto(proyectoId)

  if (!esStaff(user.rol)) {
    exigirVerificado(user)
    if (!esSuyo(proyecto.email, user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const contrato = await getContrato(proyecto.id)
  if (!contrato) throw new AuthError('No hay contrato emitido', 404)

  const tenant = await getTenantPorId(proyecto.tenantId)
  const emisor = emisorDesdeTenant(tenant, brandDesdeTenant(tenant))
  const buffer = await generarContratoPDF(contrato, proyecto, emisor)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=${contrato.numero}.pdf`,
    },
  })
})
