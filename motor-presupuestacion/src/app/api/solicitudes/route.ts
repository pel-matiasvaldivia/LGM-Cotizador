import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos, documentosProyecto, proyectos } from '@/db/schema'
import { withErrorHandling } from '@/lib/api-helpers'
import { notificarConsultaRecibida } from '@/lib/notificaciones'

// Límites de la carga de documentación (base64 inline en la DB).
const MAX_DOCS = 8
const MAX_BYTES_POR_DOC = 8 * 1024 * 1024   // 8 MB
const MAX_BYTES_TOTAL = 24 * 1024 * 1024    // 24 MB

type DocEntrada = { nombre?: string; tipoMime?: string; tamanoBytes?: number; contenidoBase64?: string }

// POST público (sin login): el cliente completa el formulario de requerimientos
// que le pasó el comercial y adjunta documentación. Crea el proyecto en borrador
// (canal 'formulario_cliente') para que el comercial lo tome y cotice.
export const POST = withErrorHandling(async (req: Request) => {
  const body = await req.json()

  const nombre = String(body.cliente_nombre || '').trim()
  const email = String(body.cliente_email || '').trim().toLowerCase()
  if (!nombre) return NextResponse.json({ error: 'Ingresá tu nombre' }, { status: 400 })
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Ingresá un email válido' }, { status: 400 })

  // Validar documentos
  const docs: DocEntrada[] = Array.isArray(body.documentos) ? body.documentos : []
  if (docs.length > MAX_DOCS) {
    return NextResponse.json({ error: `Podés adjuntar hasta ${MAX_DOCS} archivos` }, { status: 400 })
  }
  let totalBytes = 0
  for (const d of docs) {
    const bytes = Number(d.tamanoBytes) || 0
    if (!d.contenidoBase64) return NextResponse.json({ error: 'Documento sin contenido' }, { status: 400 })
    if (bytes > MAX_BYTES_POR_DOC) {
      return NextResponse.json({ error: `Cada archivo debe pesar menos de ${Math.round(MAX_BYTES_POR_DOC / 1024 / 1024)} MB` }, { status: 400 })
    }
    totalBytes += bytes
  }
  if (totalBytes > MAX_BYTES_TOTAL) {
    return NextResponse.json({ error: `El total de documentación supera los ${Math.round(MAX_BYTES_TOTAL / 1024 / 1024)} MB` }, { status: 400 })
  }

  const nombreCompleto = [nombre, body.cliente_apellido].filter(Boolean).join(' ').trim()
  const codigo = `PROY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

  const ancho = numOrNull(body.ancho_m)
  const largo = numOrNull(body.largo_m)
  const superficie = ancho && largo ? ancho * largo : numOrNull(body.superficie_m2)

  const proyecto = await db.transaction(async (tx) => {
    const [p] = await tx.insert(proyectos).values({
      codigo,
      cliente: nombreCompleto,
      razonSocial: body.cliente_empresa || null,
      contacto: nombreCompleto,
      dni: body.cliente_dni || null,
      telefono: body.cliente_telefono || null,
      email,
      ubicacion: body.ubicacion || body.ubicacion_obra || '',
      canalOrigen: 'formulario_cliente',
      estado: 'borrador',
      observaciones: body.descripcion || body.observaciones || null,
    }).returning()

    await tx.insert(datosTecnicos).values({
      proyectoId: p.id,
      ancho,
      largo,
      superficie,
      alturaLibre: numOrNull(body.altura_libre_m),
      tipologia: body.tipologia || null,
      tipoCubierta: body.tipo_cubierta || null,
      // Alcance elegido por el cliente (mismo set que el cotizador). Lo que no
      // tiene columna propia (oficina, movimiento de suelo, gestión del
      // proyecto, medidas de oficina) queda en rawData para el comercial.
      incluyeMontaje: body.incluye_montaje ?? true,
      incluyePortones: !!body.incluye_portones,
      incluyeElectrica: !!body.incluye_instalacion_electrica,
      incluyeSanitaria: !!body.incluye_bano,
      cantidadPortones: body.incluye_portones && body.cantidad_portones ? Number(body.cantidad_portones) : null,
      especificacionesAdicionales: body.descripcion || null,
      rawData: body,
    })

    if (docs.length > 0) {
      await tx.insert(documentosProyecto).values(
        docs.map((d) => ({
          proyectoId: p.id,
          nombre: String(d.nombre || 'documento'),
          tipoMime: String(d.tipoMime || 'application/octet-stream'),
          tamanoBytes: Number(d.tamanoBytes) || 0,
          contenidoBase64: String(d.contenidoBase64),
        })),
      )
    }

    return p
  })

  // Bienvenida al cliente + aviso al equipo comercial (no bloquea si el mail falla).
  await notificarConsultaRecibida(proyecto)

  return NextResponse.json({ ok: true, codigo: proyecto.codigo })
})

function numOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n !== 0 ? n : null
}
