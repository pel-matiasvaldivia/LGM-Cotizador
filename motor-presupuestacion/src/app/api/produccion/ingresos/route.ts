import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireOrdenDelProyecto } from '@/lib/scope'
import { registrarIngreso } from '@/lib/produccion'
import { materialToRow } from '@/lib/serializers'

// Ingreso de materiales (abastecimiento). Un renglón por remito del proveedor:
// los ingresos parciales son la regla, así que se suman en vez de pisarse.

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  if (!isUuid(body.materialId)) {
    return NextResponse.json({ error: 'Falta el material que ingresó' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)

  const material = await registrarIngreso(
    orden,
    {
      materialId: body.materialId,
      cantidad: Number(body.cantidad),
      remitoProveedor: typeof body.remitoProveedor === 'string' ? body.remitoProveedor : '',
      observaciones: typeof body.observaciones === 'string' ? body.observaciones : '',
      ordenCompraId: isUuid(body.ordenCompraId) ? body.ordenCompraId : null,
      documentoId: isUuid(body.documentoId) ? body.documentoId : null,
    },
    user,
  )

  return NextResponse.json({ success: true, material: materialToRow(material) })
})
