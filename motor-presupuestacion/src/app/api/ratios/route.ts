import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ratiosCostos } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import { getParametros } from '@/lib/parametros'

// GET → catálogo de ratios agrupado por rubro → subrubro (misma estructura que
// Flexxus), con el costo desglosado en Material / Mano de obra (USD) y el tipo
// de cambio vigente para mostrar/editar los equivalentes en ARS.
export const GET = withErrorHandling(async () => {
  await requireUser(['comercial', 'admin'])

  const [ratios, params] = await Promise.all([
    db.query.ratiosCostos.findMany({
      with: { subrubro: { with: { rubro: true } } },
    }),
    getParametros(),
  ])

  type SubrubroRow = {
    ratioId: string
    subrubroNombre: string
    codigoFlexxus: number
    unidad: string
    ratioCantidad: number
    materialUsd: number
    moUsd: number
    totalUsd: number
    vigente: boolean
  }
  type RubroGrupo = {
    id: string | null
    nombre: string
    codigoFlexxus: number
    orden: number
    subrubros: SubrubroRow[]
  }

  // Agrupar por rubro (cada ratio → subrubro → rubro).
  const porRubro = new Map<string, RubroGrupo>()
  for (const r of ratios) {
    const rubro = r.subrubro?.rubro
    const clave = rubro?.id ?? 'sin-rubro'
    if (!porRubro.has(clave)) {
      porRubro.set(clave, {
        id: rubro?.id ?? null,
        nombre: rubro?.nombre ?? 'Sin rubro',
        codigoFlexxus: rubro?.codigoFlexxus ?? 0,
        orden: rubro?.orden ?? 999,
        subrubros: [],
      })
    }
    const material = Number(r.precioMaterialUsd || 0)
    const mo = Number(r.precioMoUsd || 0)
    porRubro.get(clave)!.subrubros.push({
      ratioId: r.id,
      subrubroNombre: r.subrubro?.nombre ?? '',
      codigoFlexxus: r.subrubro?.codigoFlexxus ?? 0,
      unidad: r.unidad,
      ratioCantidad: Number(r.ratioCantidad || 0),
      materialUsd: material,
      moUsd: mo,
      totalUsd: material + mo,
      vigente: r.vigente,
    })
  }

  const rubros = Array.from(porRubro.values())
    .sort((a, b) => a.orden - b.orden || a.codigoFlexxus - b.codigoFlexxus)
  for (const ru of rubros) ru.subrubros.sort((a, b) => a.subrubroNombre.localeCompare(b.subrubroNombre))

  return NextResponse.json({ tipoCambio: params.tipoCambio, rubros })
})

// Campos editables (todos en USD; la ARS se deriva del tipo de cambio). El front
// convierte ARS→USD antes de mandar, así el USD queda como fuente de verdad.
const CAMPOS_EDITABLES = ['ratio_cantidad', 'precio_material_usd', 'precio_mo_usd'] as const
type Campo = (typeof CAMPOS_EDITABLES)[number]

export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { id, field, value } = await req.json()
  if (!id || !CAMPOS_EDITABLES.includes(field) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const columna = {
    ratio_cantidad: 'ratioCantidad',
    precio_material_usd: 'precioMaterialUsd',
    precio_mo_usd: 'precioMoUsd',
  }[field as Campo] as 'ratioCantidad' | 'precioMaterialUsd' | 'precioMoUsd'

  const ratio = await db.query.ratiosCostos.findFirst({ where: eq(ratiosCostos.id, id) })
  if (!ratio) return NextResponse.json({ error: 'Ratio no encontrado' }, { status: 404 })

  // Recalcular el total (material + mo) y su equivalente en ARS al tipo de cambio.
  const material = columna === 'precioMaterialUsd' ? value : Number(ratio.precioMaterialUsd || 0)
  const mo = columna === 'precioMoUsd' ? value : Number(ratio.precioMoUsd || 0)
  const totalUsd = material + mo
  const { tipoCambio } = await getParametros()

  await db.update(ratiosCostos)
    .set({
      [columna]: value,
      precioUnitarioUsd: totalUsd,
      precioUnitarioArs: totalUsd * (tipoCambio || 0),
      fechaActualizacion: new Date(),
    })
    .where(eq(ratiosCostos.id, id))

  return NextResponse.json({ success: true, totalUsd })
})
