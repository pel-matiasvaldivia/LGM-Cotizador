import CotizadorWizard from "@/components/forms/CotizadorWizard"

export default function CotizarPublicPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-200">
      <CotizadorWizard />
    </main>
  )
}
