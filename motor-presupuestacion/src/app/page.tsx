import LandingPage from '@/components/landing/LandingPage'
import DominioNoConfigurado from '@/components/branding/DominioNoConfigurado'
import { getBrandActual, getTenant } from '@/lib/tenant'

// La landing es un server component fino: resuelve la empresa por el dominio
// del request y le pasa su marca a la vista. Toda la identidad (logo, paleta,
// textos, contacto) sale de la fila del tenant en la base.
export default async function Home() {
  const tenant = await getTenant()
  if (!tenant) return <DominioNoConfigurado />
  return <LandingPage brand={await getBrandActual()} />
}
