import Anthropic from '@anthropic-ai/sdk'

// Cliente de Claude (Anthropic). La API key se lee de ANTHROPIC_API_KEY en runtime;
// se instancia perezosamente para no romper `next build` cuando la env falta.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'missing-key',
})

// Modelo por defecto para extracción/visión. Se puede sobreescribir con ANTHROPIC_MODEL.
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

export function anthropicConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Extrae el primer bloque de texto de una respuesta de Claude.
export function textoDeRespuesta(msg: Anthropic.Message): string {
  for (const bloque of msg.content) {
    if (bloque.type === 'text') return bloque.text
  }
  return ''
}

// Toma el JSON de una respuesta que puede venir envuelto en ```json ... ```.
export function parsearJson<T = unknown>(texto: string): T {
  let s = texto.trim()
  if (s.includes('```json')) {
    s = s.split('```json')[1].split('```')[0].trim()
  } else if (s.includes('```')) {
    s = s.split('```')[1].split('```')[0].trim()
  }
  return JSON.parse(s) as T
}
