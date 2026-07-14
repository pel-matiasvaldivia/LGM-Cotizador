import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { proyectos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { getParametros } from '@/lib/parametros'
import { calcularDistanciaRuta } from '@/lib/geodistance'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'

// Calcula la distancia por ruta entre la ubicación base (config) y la obra.
// GET /api/distancia?proyectoId=...   (destino = ubicación del proyecto)
//   ó  /api/distancia?destino=<direccion>
export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const url = new URL(req.url)
  const params = await getParametros()
  const origen = (url.searchParams.get('origen') || params.ubicacionBase || '').trim()
  if (!origen) {
    return NextResponse.json(
      { error: 'Falta la ubicación base. Configurala en Parámetros.' },
      { status: 400 },
    )
  }

  let destino = (url.searchParams.get('destino') || '').trim()
  const proyectoId = url.searchParams.get('proyectoId')
  if (!destino && proyectoId) {
    if (!isUuid(proyectoId)) {
      return NextResponse.json({ error: 'proyectoId inválido' }, { status: 400 })
    }
    const proyecto = await db.query.proyectos.findFirst({ where: eq(proyectos.id, proyectoId) })
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    destino = (proyecto.ubicacion || '').trim()
  }
  if (!destino) {
    return NextResponse.json(
      { error: 'Falta la dirección de la obra (ubicación del proyecto).' },
      { status: 400 },
    )
  }

  const resultado = await calcularDistanciaRuta(origen, destino)
  if (!resultado) {
    return NextResponse.json(
      { error: 'No se pudo calcular la distancia automáticamente. Cargala a mano.' },
      { status: 422 },
    )
  }

  return NextResponse.json({
    km: Math.round(resultado.km * 10) / 10,
    fuente: resultado.fuente,
    origen: resultado.origen,
    destino: resultado.destino,
  })
})
