import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ingestas } from '@/db/schema'
import { openai } from '@/lib/openai'
import { extraerVariablesR09 } from '@/lib/extractor'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const formData = await req.formData()
  const audioFile = formData.get('audio') as File | null
  const textMessage = formData.get('text') as string | null

  if (!audioFile && !textMessage) {
    return NextResponse.json({ error: 'Falta proveer audio o texto' }, { status: 400 })
  }

  let transcripcion = textMessage || ''

  // Si viene audio, transcribir con Whisper (OpenAI). Claude no transcribe audio,
  // así que este canal requiere OPENAI_API_KEY; si no está, se pide texto.
  if (audioFile) {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'La transcripción de audio no está disponible (falta OPENAI_API_KEY). ' +
            'Claude no transcribe audio: enviá el mensaje como texto y se procesará con Claude.',
        },
        { status: 501 },
      )
    }
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'es',
    })
    transcripcion = transcription.text
  }

  const [ingesta] = await db.insert(ingestas).values({
    canal: audioFile ? 'whatsapp_audio' : 'whatsapp_texto',
    rawContent: transcripcion,
  }).returning()

  const variables = await extraerVariablesR09(transcripcion)

  await db.update(ingestas)
    .set({ variablesExtraidas: variables, procesado: true })
    .where(eq(ingestas.id, ingesta.id))

  return NextResponse.json({ ingesta_id: ingesta.id, variables, transcripcion })
})
