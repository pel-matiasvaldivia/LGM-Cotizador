import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { datosTecnicos, proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { buildGeometria } from '@/lib/cad/geometry'
import { geometriaToDXF } from '@/lib/cad/dxf'
import { geometriaToIFC } from '@/lib/cad/ifc'

// Exporta la geometría base del proyecto para CAD/BIM:
//   ?formato=dxf → AutoCAD (planta + sección)
//   ?formato=ifc → Tekla Structures (modelo 3D de referencia)
export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const url = new URL(req.url)
  const proyectoId = url.searchParams.get('proyectoId')
  const formato = (url.searchParams.get('formato') || 'dxf').toLowerCase()

  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (formato !== 'dxf' && formato !== 'ifc') {
    return NextResponse.json({ error: 'formato debe ser dxf o ifc' }, { status: 400 })
  }

  const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
  if (!proyecto) throw new Error('Proyecto no encontrado')

  const dt = await db.query.datosTecnicos.findFirst({ where: eq(datosTecnicos.proyectoId, proyectoId) })

  const geo = buildGeometria(dt ?? null)
  const meta = { codigo: proyecto.codigo, cliente: proyecto.cliente, tipologia: dt?.tipologia }

  if (formato === 'dxf') {
    return new NextResponse(geometriaToDXF(geo, meta), {
      headers: {
        'Content-Type': 'application/dxf',
        'Content-Disposition': `attachment; filename=${proyecto.codigo}.dxf`,
      },
    })
  }

  return new NextResponse(geometriaToIFC(geo, meta), {
    headers: {
      'Content-Type': 'application/x-step',
      'Content-Disposition': `attachment; filename=${proyecto.codigo}.ifc`,
    },
  })
})
