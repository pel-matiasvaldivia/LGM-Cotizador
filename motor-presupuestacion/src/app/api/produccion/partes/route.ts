import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireOrdenDelProyecto } from '@/lib/scope'
import { actualizarParte, definirPartes, leerCircuito } from '@/lib/produccion'
import { parteToRow } from '@/lib/serializers'

// Partes a fabricar.
//
// POST  (oficina técnica) define qué se fabrica, normalmente un renglón por
//       subconjunto del despiece
// PATCH (taller) avanza cada parte

const ESTADOS = ['pendiente', 'en_proceso', 'terminada'] as const

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (!Array.isArray(body.partes) || body.partes.length === 0) {
    return NextResponse.json({ error: 'No hay partes para definir' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)

  const partes = body.partes.map((p: Record<string, unknown>) => ({
    nombre: String(p?.nombre ?? '').trim(),
    cantidad: Number(p?.cantidad),
    unidad: typeof p?.unidad === 'string' ? p.unidad : 'un',
  }))
  if (partes.some((p: { nombre: string }) => !p.nombre)) {
    return NextResponse.json({ error: 'Cada parte necesita un nombre' }, { status: 400 })
  }

  await definirPartes(orden, partes, user)
  const circuito = await leerCircuito(orden.id)
  return NextResponse.json({ success: true, partes: circuito.partes.map(parteToRow) })
})

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId) || !isUuid(body.parteId)) {
    return NextResponse.json({ error: 'Falta proyectoId o parteId' }, { status: 400 })
  }
  if (body.estado !== undefined && !ESTADOS.includes(body.estado)) {
    return NextResponse.json({ error: 'Estado de parte inválido' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)
  const parte = await actualizarParte(
    orden,
    body.parteId,
    {
      estado: body.estado,
      responsable: typeof body.responsable === 'string' ? body.responsable : undefined,
      notas: typeof body.notas === 'string' ? body.notas : undefined,
    },
    user,
  )

  return NextResponse.json({ success: true, parte: parteToRow(parte) })
})
