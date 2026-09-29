import LandingPage from '@/components/landing/LandingPage'
import { getBrand } from '@/lib/branding'

// La landing es un server component fino: resuelve la marca del despliegue y
// se la pasa a la vista. Toda la identidad (logo, paleta, textos, contacto)
// sale de config/brands/*.json + variables BRAND_*.
export default function Home() {
  return <LandingPage brand={getBrand()} />
}
