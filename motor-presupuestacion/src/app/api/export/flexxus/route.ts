import { NextResponse } from 'next/server'
import { csvFlexxusDeProyecto, FlexxusError } from '@/lib/flexxus-export'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

// GET /api/export/flexxus?proyectoId=...  → CSV en formato Flexxus
export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const url = new URL(req.url)
  const proyectoId = url.searchParams.get('proyectoId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  try {
    const { csv, codigo } = await csvFlexxusDeProyecto(proyectoId)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=flexxus_${codigo}.csv`,
      },
    })
  } catch (e) {
    if (e instanceof FlexxusError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
})
