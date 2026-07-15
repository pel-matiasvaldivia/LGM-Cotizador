import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ingestas } from '@/db/schema'
import { extraerVariablesR09DeDocumento } from '@/lib/extractor'
import { anthropicConfigurado } from '@/lib/anthropic'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

// POST (multipart) → extrae las variables R09 de un documento del proyecto.
// Hoy soporta PDF (planos/pliegos) vía el soporte nativo de documentos de
// Claude. El .docx no se procesa acá: para ese caso, pegar el texto en la
// opción de ingreso manual.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const form = await req.formData().catch(() => null)
  // El front puede enviar el archivo como 'file' o, por compatibilidad, 'audio'.
  const raw = form?.get('file') ?? form?.get('audio')
  if (!(raw instanceof File)) {
    return NextResponse.json({ error: 'Adjuntá el documento en el campo "file"' }, { status: 400 })
  }
  if (raw.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  if (raw.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera los 15 MB' }, { status: 400 })
  }

  const nombre = raw.name || ''
  const esPdf = raw.type === 'application/pdf' || /\.pdf$/i.test(nombre)
  if (!esPdf) {
    return NextResponse.json(
      {
        error:
          'Por ahora se admiten documentos PDF. Si tenés un .docx, copiá el texto y ' +
          'usá el ingreso manual de texto.',
      },
      { status: 415 },
    )
  }

  if (!anthropicConfigurado()) {
    return NextResponse.json(
      { error: 'La lectura de documentos con IA no está disponible (falta ANTHROPIC_API_KEY).' },
      { status: 501 },
    )
  }

  const base64 = Buffer.from(await raw.arrayBuffer()).toString('base64')
  const variables = await extraerVariablesR09DeDocumento(base64)

  const [ingesta] = await db.insert(ingestas).values({
    canal: 'documento',
    rawContent: nombre,
  }).returning()

  await db.update(ingestas)
    .set({ variablesExtraidas: variables, procesado: true })
    .where(eq(ingestas.id, ingesta.id))

  return NextResponse.json({ ingesta_id: ingesta.id, variables })
})
