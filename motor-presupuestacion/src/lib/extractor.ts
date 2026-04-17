import { openai } from './openai'

export async function extraerVariablesR09(texto: string) {
  const prompt = `
Eres un asistente especializado en análisis de proyectos de construcción de galpones industriales metálicos.

Dado el siguiente texto (puede ser una transcripción de audio de WhatsApp, un email, o fragmento de pliego):

<texto>
${texto}
</texto>

Extrae TODAS las variables que puedas identificar y devuelve SOLO un JSON con la siguiente estructura.
Si un campo no está mencionado, usa null.

{
  "cliente": string | null,
  "razon_social": string | null,
  "telefono": string | null,
  "email": string | null,
  "ubicacion": string | null,
  "ancho_m": number | null,
  "largo_m": number | null,
  "superficie_m2": number | null,
  "altura_libre_m": number | null,
  "tipologia": "nave_simple" | "doble_nave" | "entrepiso" | null,
  "incluye_proyecto": boolean | null,
  "incluye_calculo": boolean | null,
  "incluye_fabricacion": boolean | null,
  "incluye_montaje": boolean | null,
  "incluye_obra_civil": boolean | null,
  "incluye_cubierta": boolean | null,
  "incluye_cerramiento_lateral": boolean | null,
  "incluye_portones": boolean | null,
  "incluye_piso_industrial": boolean | null,
  "incluye_instalacion_electrica": boolean | null,
  "incluye_instalacion_sanitaria": boolean | null,
  "tipo_perfileria": string | null,
  "tipo_cubierta": string | null,
  "cantidad_portones": number | null,
  "plazo_obra_dias": number | null,
  "forma_pago": {
    "anticipo": number | null,
    "certificado_1": number | null,
    "certificado_2": number | null,
    "certificado_3": number | null
  } | null,
  "observaciones": string | null,
  "confianza": "alta" | "media" | "baja"
}
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  if (!response.choices[0].message.content) {
    throw new Error('No content returned from OpenAI');
  }

  return JSON.parse(response.choices[0].message.content)
}
