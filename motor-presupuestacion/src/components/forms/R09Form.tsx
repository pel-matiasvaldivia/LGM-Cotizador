'use client'

export default function R09Form({ variables, onChange }: { variables: any, onChange: (v: any) => void }) {
  return (
    <div className="bg-white p-6 border rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Cliente</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
            value={variables.cliente || ''} 
            onChange={(e) => onChange({...variables, cliente: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Ubicación</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
            value={variables.ubicacion || ''} 
            onChange={(e) => onChange({...variables, ubicacion: e.target.value})}
          />
        </div>
        
        {/* Dimensiones */}
        <div className="col-span-2 mt-4"><h3 className="font-semibold text-gray-800 border-b pb-2">Dimensiones y Alcance</h3></div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Superficie (m²)</label>
          <input 
            type="number" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
            value={variables.superficie_m2 || ''} 
            onChange={(e) => onChange({...variables, superficie_m2: Number(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Altura Libre (m)</label>
          <input 
            type="number" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" 
            value={variables.altura_libre_m || ''} 
            onChange={(e) => onChange({...variables, altura_libre_m: Number(e.target.value)})}
          />
        </div>
      </div>
      <div className="mt-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={variables.incluye_montaje !== false} onChange={(e) => onChange({...variables, incluye_montaje: e.target.checked})} />
          Incluye Montaje en obra
        </label>
        <p className="text-xs text-gray-500 mt-1">
          El presupuesto incluye todos los rubros del catálogo vigente. El montaje es la única
          opción de alcance: al desactivarlo se descuenta la mano de obra de montaje.
        </p>
      </div>
    </div>
  )
}
