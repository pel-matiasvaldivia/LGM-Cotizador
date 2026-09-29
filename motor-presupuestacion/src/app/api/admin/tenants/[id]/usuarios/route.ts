import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { AuthError } from '@/lib/errors'
import { crearUsuarioDeEmpresa } from '@/lib/plataforma'

type Ctx = { params: Promise<{ id: string }> }

// Alta del primer usuario de una empresa (su admin), que es lo que no puede
// hacerse desde el panel de la empresa porque todavía no hay con quién entrar.
// De ahí en adelante, ese admin administra sus propios usuarios.
export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  await requireSuperadmin()
  const { id } = await ctx.params
  if (!isUuid(id)) throw new AuthError('Id inválido', 400)

  const body = await req.json().catch(() => ({}))
  const usuario = await crearUsuarioDeEmpresa(id, {
    email: body.email,
    password: body.password,
    nombre: body.nombre,
    rol: body.rol === 'comercial' ? 'comercial' : 'admin',
  })

  return NextResponse.json({ usuario })
})
