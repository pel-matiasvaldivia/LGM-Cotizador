import ProyectoWizardComercial from '@/components/forms/ProyectoWizardComercial'

export default function NuevoProyectoPage() {
  return (
    <div className="py-8">
      <div className="max-w-3xl mx-auto px-6 mb-6">
        <h1 className="text-3xl font-bold text-[#1B2A47]">Nuevo Proyecto</h1>
        <p className="text-gray-600 mt-2">Cargá el proyecto a mano y generá el presupuesto Base 0 con los rubros y subrubros que elijas.</p>
      </div>
      <ProyectoWizardComercial />
    </div>
  )
}
