import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { documentosProyecto } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

// GET ?id=... → descarga un documento adjunto del proyecto. Sólo comercial/admin.
export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const id = new URL(req.url).searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const doc = await db.query.documentosProyecto.findFirst({ where: eq(documentosProyecto.id, id!) })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const buffer = Buffer.from(doc.contenidoBase64, 'base64')
  // Nombre saneado para el header Content-Disposition
  const safeName = doc.nombre.replace(/[^\w.\- ]+/g, '_') || 'documento'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': doc.tipoMime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': String(buffer.length),
    },
  })
})
