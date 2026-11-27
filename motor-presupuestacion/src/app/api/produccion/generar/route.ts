import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { requireOrdenDelProyecto } from '@/lib/scope'
import { requireTenant } from '@/lib/tenant'
import { cargarDespiecePropuesto, requireSector } from '@/lib/produccion'
import { comparar, geometriaDe, NOMBRE_BASE, obrasDelTenant, proponerDespiece } from '@/lib/explosion'
import { db } from '@/db'
import { datosTecnicos } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Despiece propuesto desde la cotización (oficina técnica).
//
// GET  devuelve la propuesta sin tocar nada, con la obra de la que se escaló,
//      el factor aplicado y qué tan parecida es
// POST la aplica como despiece de la orden
//
// Las dos aceptan `obraId` para forzar otra obra de referencia: si oficina
// técnica sabe que esta nave se parece más a otra, manda su criterio.

async function armar(proyectoId: string, tenantId: string, obraId?: string) {
  const explosion = await proponerDespiece(tenantId, proyectoId, obraId)
  const dt = await db.query.datosTecnicos.findFirst({ where: eq(datosTecnicos.proyectoId, proyectoId) })
  const g = geometriaDe(dt)
  const obras = await obrasDelTenant(tenantId)

  return {
    explosion,
    cuerpo: {
      obra: {
        id: explosion.obra.id,
        nombre: explosion.obra.nombre,
        tipologia: explosion.obra.tipologia,
        ancho: explosion.obra.ancho,
        largo: explosion.obra.largo,
        altura_libre: explosion.obra.alturaLibre,
        superficie: explosion.obra.superficie,
      },
      geometria: g,
      // Por qué esta obra y no otra: lo que no coincide, dicho en criollo.
      diferencias: explosion.parecido.motivos,
      factores: Object.fromEntries(
        Object.entries(explosion.factores).map(([base, f]) => [
          base,
          { nombre: NOMBRE_BASE[base as keyof typeof NOMBRE_BASE], factor: Number((f ?? 0).toFixed(3)) },
        ]),
      ),
      lineas: explosion.lineas.map((l) => ({
        subconjunto: l.subconjunto,
        codigo: l.codigo,
        descripcion: l.descripcion,
        unidad: l.unidad,
        cantidad: l.cantidad,
        cantidad_origen: l.cantidadOrigen,
        base: l.base,
        base_nombre: NOMBRE_BASE[l.base],
      })),
      advertencias: explosion.advertencias,
      // Las demás obras disponibles, por si hay que elegir otra.
      obras: obras
        .map((o) => ({ o, p: comparar(g, o) }))
        .sort((a, b) => a.p.distancia - b.p.distancia)
        .map(({ o, p }) => ({
          id: o.id,
          nombre: o.nombre,
          tipologia: o.tipologia,
          superficie: o.superficie,
          ancho: o.ancho,
          altura_libre: o.alturaLibre,
          diferencias: p.motivos,
        })),
    },
  }
}

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])
  requireSector(user, 'oficina_tecnica')
  const tenant = await requireTenant()

  const url = new URL(req.url)
  const proyectoId = url.searchParams.get('proyectoId')
  const obraId = url.searchParams.get('obraId')
  if (!isUuid(proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }
  await requireOrdenDelProyecto(proyectoId)

  const { cuerpo } = await armar(proyectoId, tenant.id, isUuid(obraId) ? obraId : undefined)
  return NextResponse.json(cuerpo)
})

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser(['admin', 'comercial'])
  const tenant = await requireTenant()

  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.proyectoId)) {
    return NextResponse.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const orden = await requireOrdenDelProyecto(body.proyectoId)
  const { explosion } = await armar(body.proyectoId, tenant.id, isUuid(body.obraId) ? body.obraId : undefined)

  const util = explosion.lineas.filter((l) => l.cantidad > 0)
  if (util.length === 0) {
    return NextResponse.json({ error: 'La propuesta quedó en cero: revisá la obra de referencia' }, { status: 409 })
  }

  const cantidad = await cargarDespiecePropuesto(
    orden,
    util.map((l) => ({
      subconjunto: l.subconjunto,
      codigo: l.codigo,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidad: l.cantidad,
      obraReferenciaId: explosion.obra.id,
      factor: l.factor,
    })),
    user,
    `${util.length} renglones escalados de ${explosion.obra.nombre}`,
  )

  return NextResponse.json({ success: true, renglones: cantidad, obra: explosion.obra.nombre })
})
