import { NextResponse } from 'next/server'
import { estimarCosto } from '@/lib/calculator'
import { requireTenant } from '@/lib/tenant'
import { exigirLimite, LIMITES } from '@/lib/rate-limit'
import { AuthError } from '@/lib/errors'

// Público: alimenta el precio en vivo del wizard antes de que el visitante se
// registre. No persiste nada y sólo lee los ratios vigentes de la empresa del
// dominio, pero igual se limita: es una consulta a la base por cada llamada.
export async function POST(req: Request) {
  try {
    exigirLimite(req, 'estimate', LIMITES.estimacion)
    await requireTenant()

    const { datosTecnicos } = await req.json()

    if (!datosTecnicos || !datosTecnicos.superficie_m2 || !datosTecnicos.tipologia) {
      return NextResponse.json({ totalVentaUSD: 0, totalCostoUSD: 0, cantidadItems: 0 })
    }

    const resultado = await estimarCosto(datosTecnicos)
    return NextResponse.json(resultado)
  } catch (error) {
    if (error instanceof AuthError) {
      const reintentarEn = (error as { reintentarEn?: number }).reintentarEn
      return NextResponse.json({ error: error.message }, {
        status: error.status,
        headers: reintentarEn ? { 'Retry-After': String(reintentarEn) } : undefined,
      })
    }
    console.error('Error en estimación:', error)
    // Distinguible del caso "sin datos": el front puede ocultar el badge de precio
    return NextResponse.json({ error: 'No se pudo estimar el precio' }, { status: 500 })
  }
}
