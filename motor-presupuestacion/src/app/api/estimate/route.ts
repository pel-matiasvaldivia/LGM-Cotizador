import { NextResponse } from 'next/server'
import { estimarCosto } from '@/lib/calculator'

// Público: alimenta el precio en vivo del wizard antes de que el visitante se registre.
// No persiste nada y solo lee ratios vigentes.
export async function POST(req: Request) {
  try {
    const { datosTecnicos } = await req.json()

    if (!datosTecnicos || !datosTecnicos.superficie_m2 || !datosTecnicos.tipologia) {
      return NextResponse.json({ totalVentaUSD: 0, totalCostoUSD: 0, cantidadItems: 0 })
    }

    const resultado = await estimarCosto(datosTecnicos)
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Error en estimación:', error)
    // Distinguible del caso "sin datos": el front puede ocultar el badge de precio
    return NextResponse.json({ error: 'No se pudo estimar el precio' }, { status: 500 })
  }
}
