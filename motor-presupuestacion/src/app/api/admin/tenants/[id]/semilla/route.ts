import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { AuthError } from '@/lib/errors'
import { sembrarEmpresa } from '@/lib/plataforma'

type Ctx = { params: Promise<{ id: string }> }

// Deja a una empresa en condiciones de cotizar: parámetros de costeo por
// defecto y catálogo copiado de otra empresa como plantilla. Idempotente: si ya
// tiene catálogo propio, no lo toca.
export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  await requireSuperadmin()
  const { id } = await ctx.params
  if (!isUuid(id)) throw new AuthError('Id inválido', 400)

  const body = await req.json().catch(() => ({}))
  const resultado = await sembrarEmpresa(id, { plantillaId: body.plantillaId || undefined })

  return NextResponse.json({
    ...resultado,
    mensaje: resultado.plantilla
      ? `Catálogo copiado de "${resultado.plantilla}": ${resultado.rubrosCopiados} rubros`
      : 'Parámetros listos. La empresa ya tenía catálogo, o no hay ninguno para copiar.',
  })
})
