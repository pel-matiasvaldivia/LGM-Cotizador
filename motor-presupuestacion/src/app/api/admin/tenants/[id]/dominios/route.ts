import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { AuthError } from '@/lib/errors'
import { asignarDominio, quitarDominio } from '@/lib/plataforma'

type Ctx = { params: Promise<{ id: string }> }

async function idValido(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params
  if (!isUuid(id)) throw new AuthError('Id inválido', 400)
  return id
}

// Dominios que resuelven a una empresa. Es configuración de plataforma: el admin
// de la empresa no puede tocarla (si no, podría apropiarse de un host ajeno).
export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  await requireSuperadmin()
  const id = await idValido(ctx)
  const { dominio } = await req.json().catch(() => ({}))

  const resultado = await asignarDominio(id, String(dominio || ''))
  return NextResponse.json({
    dominio: resultado.dominio,
    // Si el dominio estaba en otra empresa, se avisa: el cambio redirige un
    // sitio en producción y no puede pasar en silencio.
    aviso: resultado.movidoDe
      ? `El dominio estaba asignado a "${resultado.movidoDe}" y se movió a esta empresa`
      : undefined,
  })
})

export const DELETE = withErrorHandling(async (req: Request, ctx: Ctx) => {
  await requireSuperadmin()
  const id = await idValido(ctx)
  const dominio = new URL(req.url).searchParams.get('dominio') || ''

  await quitarDominio(id, dominio)
  return NextResponse.json({ success: true })
})
