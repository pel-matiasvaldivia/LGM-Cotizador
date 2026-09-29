import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/auth'
import { isUuid, withErrorHandling } from '@/lib/api-helpers'
import { actualizarEmpresa, borrarEmpresa, buscarEmpresa } from '@/lib/plataforma'
import { AuthError } from '@/lib/errors'

type Ctx = { params: Promise<{ id: string }> }

async function idValido(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params
  if (!isUuid(id)) throw new AuthError('Id inválido', 400)
  return id
}

// Renombrar o activar/desactivar una empresa. Desactivada, sus dominios dejan
// de resolver (queda la pantalla de "dominio no configurado") pero no se
// pierde nada: es la forma de dar de baja el servicio sin borrar datos.
export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  await requireSuperadmin()
  const id = await idValido(ctx)
  const body = await req.json().catch(() => ({}))

  await actualizarEmpresa(id, { nombre: body.nombre, activo: body.activo })
  const empresa = await buscarEmpresa(id)

  return NextResponse.json({
    empresa: { id: empresa.id, slug: empresa.slug, nombre: empresa.nombre, activo: empresa.activo },
  })
})

// Borrado definitivo: se lleva usuarios, proyectos, catálogo y configuración de
// esa empresa. Pide repetir el identificador como confirmación.
export const DELETE = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const yo = await requireSuperadmin()
  const id = await idValido(ctx)
  const confirmacion = new URL(req.url).searchParams.get('confirmar') || ''

  const { slug } = await borrarEmpresa(id, { confirmacion, tenantPropioId: yo.tenantId })
  return NextResponse.json({ success: true, slug })
})
