import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, textoDeRespuesta, parsearJson } from '@/lib/anthropic'
import { withErrorHandling } from '@/lib/api-helpers'
import { requireTenant } from '@/lib/tenant'
import { exigirLimite, LIMITES } from '@/lib/rate-limit'

// Tope de imagen. Claude acepta más, pero acá el límite es económico: una
// imagen grande es una llamada cara, y esta ruta la puede invocar cualquiera.
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024

// Media types que acepta la API de visión de Claude.
const MEDIA_VALIDOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type MediaType = (typeof MEDIA_VALIDOS)[number]

// Separa un data URL (`data:image/png;base64,XXXX`) en media type + datos base64.
function parseDataUrl(input: string): { mediaType: MediaType; data: string } | null {
  const m = /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(input.trim())
  if (!m) return null
  const mediaType = m[1] as MediaType
  if (!MEDIA_VALIDOS.includes(mediaType)) return null
  return { mediaType, data: m[2] }
}

// Pública porque el wizard lee el plano antes de que el visitante se registre.
// Por eso los tres frenos: que el dominio sea de una empresa, un tope de
// llamadas por IP y un tope de tamaño. Es la ruta que gasta plata de verdad.
export const POST = withErrorHandling(async (req: Request) => {
  exigirLimite(req, 'vision', LIMITES.vision)
  await requireTenant()

  const { imageBase64 } = await req.json()

  if (!imageBase64) {
    return NextResponse.json({ error: 'Falta imagen' }, { status: 400 })
  }

  const img = parseDataUrl(imageBase64)
  if (!img) {
    return NextResponse.json(
      { error: 'Formato de imagen inválido. Usá JPEG, PNG, GIF o WebP en base64.' },
      { status: 400 },
    )
  }

  if (Buffer.byteLength(img.data, 'base64') > MAX_IMAGEN_BYTES) {
    return NextResponse.json(
      { error: `La imagen supera los ${MAX_IMAGEN_BYTES / 1024 / 1024} MB` },
      { status: 413 },
    )
  }

  const prompt = `Sos un ingeniero civil estructural analizando un boceto o plano enviado por el cliente para construir una nave industrial.
Extrae o infiere estimativamente si no está claro de la imagen las siguientes dimensiones. Respondé ÚNICAMENTE con un JSON puro con este formato:
{
  "ancho_m": <numero>,
  "largo_m": <numero>,
  "superficie_m2": <numero>,
  "altura_libre_m": <numero>,
  "tipologia": "<ALMA_LLENA | ALVEOLAR | RETICULADO | INDEFINIDO>"
}`

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
    { type: 'text', text: prompt },
  ]

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    system: 'Respondé ÚNICAMENTE con el objeto JSON pedido, sin texto adicional.',
    messages: [{ role: 'user', content }],
  })

  const aiText = textoDeRespuesta(response)

  let data
  try {
    data = parsearJson(aiText)
  } catch {
    console.error('Claude vision parse error. Raw text:', aiText)
    return NextResponse.json({ success: false, data: null, error: aiText })
  }

  return NextResponse.json({ success: true, data })
})
