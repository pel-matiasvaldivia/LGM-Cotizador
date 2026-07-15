import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { preciosReferencia } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { leerXlsx } from '@/lib/xlsx-lite'
import { parsearPreciosReferencia } from '@/lib/precios-referencia-import'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// POST (multipart con `file`) → parsea la hoja de costos unitarios ("Hoja2" /
// Revista Cifras) y hace upsert idempotente por (codigo, descripcion). Permite
// recargar la biblioteca de precios con una planilla actualizada.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['admin'])

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Adjuntá el archivo .xlsx en el campo "file"' }, { status: 400 })
  }
  if (file.size === 0) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo supera los 10 MB' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  let hojas
  try {
    hojas = leerXlsx(buf)
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo. ¿Es un .xlsx válido?' }, { status: 400 })
  }

  // Preferir "Hoja2"; si no, la hoja que produzca más ítems con precio.
  const preferida = hojas.find((h) => /hoja\s*2/i.test(h.nombre))
  let preview = preferida ? parsearPreciosReferencia(preferida.filas) : null
  let hojaUsada = preferida?.nombre ?? ''
  if (!preview || preview.items.length === 0) {
    for (const h of hojas) {
      const p = parsearPreciosReferencia(h.filas)
      if (!preview || p.items.length > preview.items.length) {
        preview = p
        hojaUsada = h.nombre
      }
    }
  }

  if (!preview || preview.items.length === 0) {
    return NextResponse.json({ error: 'No se detectaron ítems de precio en el archivo' }, { status: 400 })
  }

  // Upsert por (codigo, descripcion) en lote.
  let procesados = 0
  await db.transaction(async (tx) => {
    for (const it of preview!.items) {
      await tx
        .insert(preciosReferencia)
        .values({
          categoria: it.categoria,
          codigo: it.codigo,
          descripcion: it.descripcion,
          unidad: it.unidad,
          costoMaterialUsd: it.costoMaterialUsd,
          costoEjecucionUsd: it.costoEjecucionUsd,
          costoTotalUsd: it.costoTotalUsd,
        })
        .onConflictDoUpdate({
          target: [preciosReferencia.codigo, preciosReferencia.descripcion],
          set: {
            categoria: it.categoria,
            unidad: it.unidad,
            costoMaterialUsd: it.costoMaterialUsd,
            costoEjecucionUsd: it.costoEjecucionUsd,
            costoTotalUsd: it.costoTotalUsd,
            updatedAt: sql`now()`,
          },
        })
      procesados++
    }
  })

  return NextResponse.json({
    hoja: hojaUsada,
    procesados,
    categorias: preview.categorias,
  })
})
