import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { leerXlsx } from '@/lib/xlsx-lite'
import { parsearBase0, type PreviewBase0 } from '@/lib/base0-import'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// POST (multipart con `file`) → preview de ratios detectados (dry-run, no persiste).
// Se elige la hoja "BASE 0" si existe; si no, la primera con rubros detectables.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['admin'])

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Adjuntá el archivo .xlsx en el campo "file"' }, { status: 400 })
  }
  if (file.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())

  let hojas
  try {
    hojas = leerXlsx(buf)
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo. ¿Es un .xlsx válido?' }, { status: 400 })
  }

  // Preferir la hoja BASE 0; si no, la que produzca más rubros mapeados.
  const preferida = hojas.find((h) => /base\s*0/i.test(h.nombre))
  let preview: PreviewBase0
  let hojaUsada: string
  if (preferida) {
    preview = parsearBase0(preferida.filas)
    hojaUsada = preferida.nombre
  } else {
    let mejor: { nombre: string; preview: PreviewBase0 } | null = null
    for (const h of hojas) {
      const p = parsearBase0(h.filas)
      const mapeados = p.rubros.filter((r) => r.codigoFlexxus !== null).length
      const mejorMapeados = mejor ? mejor.preview.rubros.filter((r) => r.codigoFlexxus !== null).length : -1
      if (mapeados > mejorMapeados) mejor = { nombre: h.nombre, preview: p }
    }
    preview = mejor?.preview ?? { rubros: [], sinMapear: [], advertencias: ['El archivo no tiene hojas legibles'] }
    hojaUsada = mejor?.nombre ?? ''
  }

  return NextResponse.json({ hoja: hojaUsada, preview })
})
