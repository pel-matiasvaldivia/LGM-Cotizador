import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { configuracion } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { getParametros } from '@/lib/parametros'
import { withErrorHandling } from '@/lib/api-helpers'

// Claves numéricas editables (0..N). `zonas` se maneja aparte (objeto).
const NUMERICAS = [
  'tipo_cambio_usd',
  'iva',
  'costos_indirectos',
  'beneficio',
  'desperdicios',
  'coeficiente_zona',
  'flete_camion_usd_km',
  'flete_camioneta_usd_km',
  'viajes_camion',
  'viajes_camioneta',
] as const

export const GET = withErrorHandling(async () => {
  await requireUser(['comercial', 'admin'])
  return NextResponse.json({ parametros: await getParametros() })
})

export const PATCH = withErrorHandling(async (req: Request) => {
  await requireUser(['admin'])
  const body = await req.json().catch(() => ({}))

  const updates: Array<{ clave: string; valor: unknown }> = []
  for (const clave of NUMERICAS) {
    if (body[clave] === undefined) continue
    const n = Number(body[clave])
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: `Valor inválido para ${clave}` }, { status: 400 })
    }
    updates.push({ clave, valor: n })
  }
  if (body.ubicacion_base !== undefined) {
    if (typeof body.ubicacion_base !== 'string') {
      return NextResponse.json({ error: 'ubicacion_base debe ser texto' }, { status: 400 })
    }
    updates.push({ clave: 'ubicacion_base', valor: body.ubicacion_base.trim() })
  }
  if (body.zonas !== undefined) {
    if (typeof body.zonas !== 'object' || body.zonas === null || Array.isArray(body.zonas)) {
      return NextResponse.json({ error: 'zonas debe ser un objeto { provincia: coeficiente }' }, { status: 400 })
    }
    const zonas: Record<string, number> = {}
    for (const [k, v] of Object.entries(body.zonas)) {
      const n = Number(v)
      if (Number.isFinite(n)) zonas[k] = n
    }
    updates.push({ clave: 'zonas', valor: zonas })
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  for (const u of updates) {
    await db
      .insert(configuracion)
      .values({ clave: u.clave, valor: u.valor })
      .onConflictDoUpdate({ target: configuracion.clave, set: { valor: u.valor, updatedAt: sql`now()` } })
  }

  return NextResponse.json({ parametros: await getParametros() })
})
