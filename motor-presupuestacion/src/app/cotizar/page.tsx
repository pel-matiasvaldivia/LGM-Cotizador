import CotizadorWizard from "@/components/forms/CotizadorWizard"
import DominioNoConfigurado from "@/components/branding/DominioNoConfigurado"
import { getBrandActual, getTenant } from "@/lib/tenant"

export default async function CotizarPublicPage() {
  // Sin empresa no hay a quién cotizarle: el POST fallaría igual más adelante.
  if (!(await getTenant())) return <DominioNoConfigurado />

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-200">
      <CotizadorWizard brand={await getBrandActual()} />
    </main>
  )
}
