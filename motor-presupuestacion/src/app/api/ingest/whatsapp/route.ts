import { openai } from '@/lib/openai'
import { createClient } from '@/lib/supabase'
import { extraerVariablesR09 } from '@/lib/extractor'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const textMessage = formData.get('text') as string | null

    if (!audioFile && !textMessage) {
      return NextResponse.json({ error: 'Falta proveer audio o texto' }, { status: 400 })
    }

    let transcripcion = textMessage || ''

    // Si viene audio, transcribir con Whisper
    if (audioFile) {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'es',
      })
      transcripcion = transcription.text
    }

    // Guardar ingesta cruda
    const supabase = createClient()
    const { data: ingesta, error: insertError } = await supabase
      .from('ingestas')
      .insert({ 
        canal: audioFile ? 'whatsapp_audio' : 'whatsapp_texto', 
        raw_content: transcripcion 
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // Extraer variables con GPT-4o
    const variables = await extraerVariablesR09(transcripcion)

    const { error: updateError } = await supabase
      .from('ingestas')
      .update({ variables_extraidas: variables, procesado: true })
      .eq('id', ingesta.id)

    if (updateError) {
      console.error('Error updating ingesta with variables', updateError)
    }

    return NextResponse.json({ ingesta_id: ingesta.id, variables, transcripcion })
  } catch (error: any) {
    console.error('Error en ingest/whatsapp:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
