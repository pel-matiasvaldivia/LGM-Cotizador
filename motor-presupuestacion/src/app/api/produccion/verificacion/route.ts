import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireOrdenDelProyecto } from '@/lib/scope'
import { leerCircuito, verificarStock, type VerificacionLinea } from '@/lib/produccion'
import { materialToRow } from '@/lib/serializers'

// Verificación de stock (abastecimiento): cuánto hay de cada renglón.
// No es un sí/no: la disponibilidad parcial es el caso normal y de ahí sale
// cuánto hay que comprar.

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (!Array.isArray(body.lineas)) {
    return NextResponse.json({ error: 'Falta el detalle de la verificación' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)

  const lineas: VerificacionLinea[] = []
  for (const linea of body.lineas) {
    if (!isUuid(linea?.materialId)) {
      return NextResponse.json({ error: 'Renglón sin material válido' }, { status: 400 })
    }
    const disponible = Number(linea.cantidadDisponible)
    if (!Number.isFinite(disponible) || disponible < 0) {
      return NextResponse.json({ error: 'Las cantidades no pueden ser negativas' }, { status: 400 })
    }
    lineas.push({
      materialId: linea.materialId,
      cantidadDisponible: disponible,
      nota: typeof linea.nota === 'string' ? linea.nota : '',
    })
  }

  const resumen = await verificarStock(orden, lineas, user)
  const circuito = await leerCircuito(orden.id)

  return NextResponse.json({
    success: true,
    ...resumen,
    materiales: circuito.materiales.map(materialToRow),
  })
})
