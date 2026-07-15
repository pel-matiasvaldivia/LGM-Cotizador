import { and, asc, eq, ilike, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { preciosReferencia } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'

// GET /api/precios-referencia?q=texto&categoria=...&limit=...
// Biblioteca de precios de referencia para consulta del comercial al editar una
// cotización. Búsqueda por texto (descripción/código) y filtro por categoría.
export const GET = withErrorHandling(async (req: Request) => {
  await requireUser(['comercial', 'admin'])

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const categoria = (url.searchParams.get('categoria') || '').trim()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500)

  const filtros = [eq(preciosReferencia.activo, true)]
  if (q) {
    const patron = `%${q}%`
    filtros.push(or(ilike(preciosReferencia.descripcion, patron), ilike(preciosReferencia.codigo, patron))!)
  }
  if (categoria) filtros.push(eq(preciosReferencia.categoria, categoria))

  const items = await db.query.preciosReferencia.findMany({
    where: and(...filtros),
    orderBy: [asc(preciosReferencia.categoria), asc(preciosReferencia.codigo)],
    limit,
  })

  // Lista de categorías disponibles (para el filtro del UI).
  const todas = await db.query.preciosReferencia.findMany({
    columns: { categoria: true },
    where: eq(preciosReferencia.activo, true),
  })
  const categorias = [...new Set(todas.map((t) => t.categoria).filter(Boolean))].sort()

  return NextResponse.json({
    categorias,
    items: items.map((i) => ({
      id: i.id,
      categoria: i.categoria,
      codigo: i.codigo,
      descripcion: i.descripcion,
      unidad: i.unidad,
      costo_material_usd: i.costoMaterialUsd,
      costo_ejecucion_usd: i.costoEjecucionUsd,
      costo_total_usd: i.costoTotalUsd,
    })),
  })
})
