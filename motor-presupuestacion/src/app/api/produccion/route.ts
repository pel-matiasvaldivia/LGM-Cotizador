import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireOrdenDelProyecto } from '@/lib/scope'
import {
  ETAPAS, esSector, leerBitacora, leerCircuito, sincronizarEtapa, SECTORES,
} from '@/lib/produccion'
import {
  bitacoraToRow, despachoToRow, materialToRow, ordenCompraToRow, ordenToRow, parteToRow,
} from '@/lib/serializers'

// Estado completo del circuito de producción de una obra: dónde está, qué
// falta y quién hizo qué. Es lo que alimenta el panel del proyecto.
//
// Lo ve todo el staff: la trazabilidad no sirve si cada sector sólo puede ver
// su parte. Lo que cambia por sector es qué puede *hacer*, no qué puede mirar.

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])

  const proyectoId = new URL(req.url).searchParams.get('proyectoId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(proyectoId)
  const etapa = await sincronizarEtapa(orden)
  const [circuito, bitacora] = await Promise.all([leerCircuito(orden.id), leerBitacora(orden.id)])

  return NextResponse.json({
    orden: { ...ordenToRow(orden), etapa },
    etapas: ETAPAS,
    // Qué puede hacer QUIEN está mirando: la UI no decide permisos, los refleja.
    puede: Object.fromEntries(SECTORES.map((s) => [s, esSector(user, s)])),
    materiales: circuito.materiales.map(materialToRow),
    ordenes_compra: circuito.ordenesCompra.map((o) => ordenCompraToRow(o, o.items)),
    partes: circuito.partes.map(parteToRow),
    despachos: circuito.despachos.map((d) => despachoToRow(d, d.items)),
    bitacora: bitacora.map(bitacoraToRow),
  })
})
