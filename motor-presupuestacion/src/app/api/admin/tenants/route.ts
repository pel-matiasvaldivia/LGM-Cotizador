import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/auth'
import { withErrorHandling } from '@/lib/api-helpers'
import {
  crearEmpresa, crearUsuarioDeEmpresa, listarEmpresas, sembrarEmpresa, validarCredenciales,
} from '@/lib/plataforma'

// Empresas del servicio. Sólo para superadmins: para un admin de empresa estas
// rutas responden 404 (ver requireSuperadmin).

export const GET = withErrorHandling(async () => {
  await requireSuperadmin()
  return NextResponse.json({ empresas: await listarEmpresas() })
})

// Alta guiada: crea la empresa, le asigna el dominio, le siembra el catálogo y
// los parámetros, y le crea su primer admin. Todo opcional menos la empresa.
export const POST = withErrorHandling(async (req: Request) => {
  await requireSuperadmin()
  const body = await req.json().catch(() => ({}))

  const dominios = String(body.dominios || '')
    .split(',')
    .map((d: string) => d.trim())
    .filter(Boolean)

  // Todo lo validable se valida antes de escribir: si la contraseña del admin no
  // sirve, no queremos dejar una empresa a medio crear.
  if (body.adminEmail) validarCredenciales(body.adminEmail, body.adminPassword)

  const empresa = await crearEmpresa({ slug: body.slug, nombre: body.nombre, dominios })

  const pasos: string[] = [`Empresa "${empresa.slug}" creada`]
  if (dominios.length) pasos.push(`Dominios asignados: ${dominios.join(', ')}`)

  if (body.sembrar !== false) {
    const { rubrosCopiados, plantilla } = await sembrarEmpresa(empresa.id, {
      plantillaId: body.plantillaId || undefined,
    })
    pasos.push(plantilla
      ? `Catálogo copiado de "${plantilla}" (${rubrosCopiados} rubros) y parámetros iniciales`
      : 'Parámetros de costeo iniciales (sin catálogo: cargarlo con la importación de Base 0)')
  }

  // El admin se crea al final: si algo falla antes, no queda un usuario suelto.
  if (body.adminEmail) {
    const admin = await crearUsuarioDeEmpresa(empresa.id, {
      email: body.adminEmail,
      password: body.adminPassword,
      nombre: body.adminNombre,
      rol: 'admin',
    })
    pasos.push(`Admin creado: ${admin.email}`)
  }

  return NextResponse.json({ empresa: { id: empresa.id, slug: empresa.slug }, pasos })
})
