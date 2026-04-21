import { estimarCosto } from '@/lib/calculator'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { datosTecnicos } = body

    if (!datosTecnicos || !datosTecnicos.superficie_m2 || !datosTecnicos.tipologia) {
      return NextResponse.json({ totalVentaUSD: 0, totalCostoUSD: 0, cantidadItems: 0 })
    }

    const resultado = await estimarCosto(datosTecnicos)
    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error('Error en estimación:', error)
    return NextResponse.json({ totalVentaUSD: 0, totalCostoUSD: 0, cantidadItems: 0 })
  }
}
