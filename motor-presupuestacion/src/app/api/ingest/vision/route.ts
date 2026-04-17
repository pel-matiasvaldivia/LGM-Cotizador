import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Asegúrate de que OPENAI_API_KEY esté seteada en tu .env.local / Supabase
const openai = new OpenAI()

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'Falta imagen' }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Sos un ingeniero civil estructural analizando un boceto o plano enviado por el cliente para construir una nave industrial. 
                Extrae o infiere estimativamente si no está claro de la imagen las siguientes dimensiones. Responde ÚNICAMENTE con un JSON puro con este formato:
                {
                  "ancho_m": <numero>,
                  "largo_m": <numero>,
                  "superficie_m2": <numero>,
                  "altura_libre_m": <numero>,
                  "tipologia": "<ALMA_LLENA | ALVEOLAR | RETICULADO | INDEFINIDO>"
                }` 
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const aiText = response.choices[0].message.content || ''
    
    // Buscar JSON dentro de la respuesta si GPT agregó backticks
    let jsonStr = aiText
    if (aiText.includes('```json')) {
      jsonStr = aiText.split('```json')[1].split('```')[0].trim()
    } else if (aiText.includes('```')) {
      jsonStr = aiText.split('```')[1].split('```')[0].trim()
    }

    let data
    try {
      data = JSON.parse(jsonStr)
    } catch(e) {
      console.error("OpenAI vision parse error. Raw text:", aiText)
      return NextResponse.json({ success: false, data: null, error: aiText })
    }

    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    console.error('Error en Visión AI:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
