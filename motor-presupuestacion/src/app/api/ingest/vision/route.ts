import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, textoDeRespuesta, parsearJson } from '@/lib/anthropic'

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

export async function POST(req: Request) {
  try {
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
  } catch (error: any) {
    console.error('Error en Visión AI:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
