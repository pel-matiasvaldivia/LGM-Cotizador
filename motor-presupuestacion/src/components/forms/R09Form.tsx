'use client'

import SelectorRubros from './SelectorRubros'

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
      {/* Alcance / módulos opcionales */}
      <div className="col-span-2 mt-6"><h3 className="font-semibold text-gray-800 border-b pb-2">Alcance del proyecto</h3></div>
      <div className="col-span-2 mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={variables.incluye_montaje !== false} onChange={(e) => onChange({...variables, incluye_montaje: e.target.checked})} />
          Incluye Montaje en obra
        </label>
        <p className="text-xs text-gray-500 -mt-2">La nave (estructura, cerramientos, cubierta y piso) siempre se incluye. Activá los módulos adicionales según el proyecto.</p>

        {/* Oficina interior */}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!variables.incluye_oficina} onChange={(e) => onChange({...variables, incluye_oficina: e.target.checked})} />
          Oficina interior (tabiques, revestimientos, obra civil)
        </label>
        {variables.incluye_oficina && (
          <div className="ml-6 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600">Ancho oficina (m)</label>
              <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                value={variables.oficina_ancho_m || ''} onChange={(e) => onChange({...variables, oficina_ancho_m: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Largo oficina (m)</label>
              <input type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                value={variables.oficina_largo_m || ''} onChange={(e) => onChange({...variables, oficina_largo_m: Number(e.target.value)})} />
            </div>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input type="checkbox" checked={!!variables.oficina_planta_alta} onChange={(e) => onChange({...variables, oficina_planta_alta: e.target.checked})} />
              Planta alta
            </label>
          </div>
        )}

        {/* Baño interior */}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!variables.incluye_bano} onChange={(e) => onChange({...variables, incluye_bano: e.target.checked})} />
          Baño interior (instalación sanitaria)
        </label>
        {variables.incluye_bano && (
          <div className="ml-6">
            <label className="block text-xs text-gray-600">Cantidad de baños</label>
            <input type="number" min="1" className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm p-2 border"
              value={variables.cantidad_banos || 1} onChange={(e) => onChange({...variables, cantidad_banos: Number(e.target.value)})} />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!variables.incluye_instalacion_electrica} onChange={(e) => onChange({...variables, incluye_instalacion_electrica: e.target.checked})} />
          Instalación eléctrica
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!variables.incluye_movimiento_suelo} onChange={(e) => onChange({...variables, incluye_movimiento_suelo: e.target.checked})} />
          Movimiento de suelo
        </label>

        {/* Portones */}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!variables.incluye_portones} onChange={(e) => onChange({...variables, incluye_portones: e.target.checked})} />
          Portones
        </label>
        {variables.incluye_portones && (
          <div className="ml-6">
            <label className="block text-xs text-gray-600">Cantidad de portones</label>
            <input type="number" min="1" className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm p-2 border"
              value={variables.cantidad_portones || 1} onChange={(e) => onChange({...variables, cantidad_portones: Number(e.target.value)})} />
          </div>
        )}
      </div>

      {/* Selección de rubros y subrubros del catálogo real */}
      <div className="mt-8">
        <h3 className="font-semibold text-gray-800 border-b pb-2">Rubros y subrubros a cotizar</h3>
        <p className="text-xs text-gray-500 mt-2 mb-3">
          Activá o desactivá exactamente lo que entra en esta cotización. Lo que dejes marcado acá manda sobre
          el alcance automático: se generará una línea de presupuesto por cada subrubro seleccionado.
        </p>
        <SelectorRubros
          seleccionados={variables.subrubros_seleccionados}
          onChange={(ids) => onChange({ ...variables, subrubros_seleccionados: ids })}
        />
      </div>
    </div>
  )
}
