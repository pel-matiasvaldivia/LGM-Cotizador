import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { listarEmpresas } from '@/lib/plataforma'
import { getTenant } from '@/lib/tenant'
import PlataformaPanel from '@/components/plataforma/PlataformaPanel'

// Administración de la plataforma: las empresas del servicio. Cuelga del layout
// del panel (misma sesión y misma marca), pero el acceso lo decide la marca de
// superadmin, no el rol dentro de la empresa.
//
// Para un admin de empresa la pantalla no existe: 404, no "sin permisos".
export default async function PlataformaPage() {
  const user = await getCurrentUser()
  if (!user?.superadmin) notFound()

  const tenant = await getTenant()

  return (
    <PlataformaPanel
      empresas={await listarEmpresas()}
      tenantPropioId={tenant?.id ?? null}
    />
  )
}
