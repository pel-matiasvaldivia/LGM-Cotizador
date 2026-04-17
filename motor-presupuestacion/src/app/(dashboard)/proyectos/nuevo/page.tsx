import ProyectoForm from '@/components/forms/ProyectoForm'

export default function NuevoProyectoPage() {
  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto px-6 mb-6">
        <h1 className="text-3xl font-bold text-[#1B2A47]">Nuevo Proyecto</h1>
        <p className="text-gray-600 mt-2">Cargue los requerimientos del lead para generar un R-09 y un presupuesto inicial.</p>
      </div>
      <ProyectoForm />
    </div>
  )
}
