import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ratiosCostos, rubros, subrubros } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
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
    subrubroId: string
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
      subrubroId: r.subrubro?.id ?? '',
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

  const grupos = Array.from(porRubro.values())
    .sort((a, b) => a.orden - b.orden || a.codigoFlexxus - b.codigoFlexxus)
  for (const ru of grupos) ru.subrubros.sort((a, b) => a.subrubroNombre.localeCompare(b.subrubroNombre))

  return NextResponse.json({ tipoCambio: params.tipoCambio, rubros: grupos })
})

// POST → crea un subrubro nuevo (con su ratio) bajo un rubro existente. Permite
// separar un rubro en tantos subrubros como haga falta, cada uno con su línea.
export const POST = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const body = await req.json()
  const { rubroId } = body
  const nombre = String(body.nombre || '').trim()
  if (!isUuid(rubroId) || !nombre) {
    return NextResponse.json({ error: 'Falta el rubro o el nombre del subrubro' }, { status: 400 })
  }
  const rubro = await db.query.rubros.findFirst({ where: eq(rubros.id, rubroId) })
  if (!rubro) return NextResponse.json({ error: 'Rubro no encontrado' }, { status: 404 })

  const unidad = String(body.unidad || 'm2').trim() || 'm2'
  const codigoFlexxus = Number(body.codigoFlexxus) || 0
  const materialUsd = Math.max(Number(body.materialUsd) || 0, 0)
  const moUsd = Math.max(Number(body.moUsd) || 0, 0)
  const ratioCantidad = Number(body.ratioCantidad) > 0 ? Number(body.ratioCantidad) : 1
  const totalUsd = materialUsd + moUsd
  const { tipoCambio } = await getParametros()

  const nuevo = await db.transaction(async (tx) => {
    const [sub] = await tx.insert(subrubros)
      .values({ rubroId, nombre, codigoFlexxus })
      .returning()
    const [ratio] = await tx.insert(ratiosCostos).values({
      subrubroId: sub.id,
      unidad,
      ratioCantidad,
      precioMaterialUsd: materialUsd,
      precioMoUsd: moUsd,
      precioUnitarioUsd: totalUsd,
      precioUnitarioArs: totalUsd * (tipoCambio || 0),
    }).returning()
    return { ratioId: ratio.id, subrubroId: sub.id }
  })

  return NextResponse.json({ success: true, ...nuevo })
})

// Campos numéricos editables (en USD; la ARS se deriva del tipo de cambio).
const CAMPOS_NUMERICOS = ['ratio_cantidad', 'precio_material_usd', 'precio_mo_usd'] as const
type CampoNum = (typeof CAMPOS_NUMERICOS)[number]

export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const { id, field, value } = await req.json()
  if (!isUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const ratio = await db.query.ratiosCostos.findFirst({ where: eq(ratiosCostos.id, id) })
  if (!ratio) return NextResponse.json({ error: 'Ratio no encontrado' }, { status: 404 })

  // Renombrar el subrubro (texto).
  if (field === 'subrubro_nombre') {
    const nombre = String(value || '').trim()
    if (!nombre) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
    await db.update(subrubros).set({ nombre }).where(eq(subrubros.id, ratio.subrubroId))
    return NextResponse.json({ success: true })
  }

  // Campos numéricos del ratio.
  if (!CAMPOS_NUMERICOS.includes(field) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }
  const columna = {
    ratio_cantidad: 'ratioCantidad',
    precio_material_usd: 'precioMaterialUsd',
    precio_mo_usd: 'precioMoUsd',
  }[field as CampoNum] as 'ratioCantidad' | 'precioMaterialUsd' | 'precioMoUsd'

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

// DELETE ?id=ratioId → elimina el subrubro (y su ratio, por cascada).
export const DELETE = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])
  const id = new URL(req.url).searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const ratio = await db.query.ratiosCostos.findFirst({ where: eq(ratiosCostos.id, id!) })
  if (!ratio) return NextResponse.json({ error: 'Ratio no encontrado' }, { status: 404 })

  // Borrar el subrubro elimina su ratio por la FK on delete cascade.
  await db.delete(subrubros).where(eq(subrubros.id, ratio.subrubroId))
  return NextResponse.json({ success: true })
})
