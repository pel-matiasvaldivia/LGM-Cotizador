import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { proyectos } from '@/db/schema'
import { construirR04 } from '@/lib/pdf-r04'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser()

  const url = new URL(req.url)
  const proyectoId = url.searchParams.get('proyectoId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) throw new Error('Proyecto no encontrado')

  // El comercial/admin puede descargar cualquier presupuesto. El cliente sólo
  // el suyo (mismo email) y únicamente una vez enviado.
  const esStaff = user.rol === 'comercial' || user.rol === 'admin'
  if (!esStaff) {
    const propio = proyecto.email && proyecto.email.toLowerCase() === user.email.toLowerCase()
    if (!propio || proyecto.estado === 'borrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const r04 = await construirR04(proyectoId)
  if (!r04) throw new Error('Proyecto no encontrado')

  return new NextResponse(new Uint8Array(r04.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=${r04.filename}`,
    },
  })
})
