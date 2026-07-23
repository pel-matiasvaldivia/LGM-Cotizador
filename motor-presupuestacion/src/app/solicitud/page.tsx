import SolicitudForm from '@/components/forms/SolicitudForm'

// Formulario público de requerimientos que el comercial comparte con el cliente.
// No requiere login: el cliente completa los datos básicos y adjunta documentación.
export default function SolicitudPublicPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-200">
      <SolicitudForm />
    </main>
  )
}
