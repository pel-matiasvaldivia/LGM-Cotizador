'use client'

export default function Base0Table({ items, onChange, onNext }: { items: any[], onChange: (items: any[]) => void, onNext: () => void }) {
  const updateMargen = (index: number, newMargen: number) => {
    const newItems = [...items];
    newItems[index].margen = newMargen;
    newItems[index].precio_venta_usd = newItems[index].costo_total_usd * (1 + newMargen);
    newItems[index].precio_venta_ars = newItems[index].costo_total_ars * (1 + newMargen);
    onChange(newItems);
  }

  const totalCosto = items.reduce((acc, curr) => acc + (curr.costo_total_usd || 0), 0);
  const totalVenta = items.reduce((acc, curr) => acc + (curr.precio_venta_usd || 0), 0);

  return (
    <div className="bg-white p-6 border rounded-lg shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700">
          <thead className="bg-[#1B2A47] text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Rubro/Descripción</th>
              <th className="px-4 py-3 font-semibold text-center">Cant.</th>
              <th className="px-4 py-3 font-semibold text-right">Costo USD</th>
              <th className="px-4 py-3 font-semibold text-center">Margen (%)</th>
              <th className="px-4 py-3 font-semibold text-right">Venta USD</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">{item.descripcion || item.subrubro?.nombre || 'Item'}</td>
                <td className="px-4 py-3 text-center">{Number(item.cantidad || 0).toFixed(2)} {item.unidad}</td>
                <td className="px-4 py-3 text-right">u$d {Number(item.costo_total_usd || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <input 
                    type="number" 
                    step="0.01" 
                    className="w-20 px-2 py-1 border rounded text-center" 
                    value={item.margen || 0.2} 
                    onChange={(e) => updateMargen(idx, parseFloat(e.target.value))}
                  />
                </td>
                <td className="px-4 py-3 text-right font-medium">u$d {Number(item.precio_venta_usd || 0).toFixed(2)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-400">Presione calcular para generar los items...</td></tr>
            )}
          </tbody>
          <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-200">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right">TOTALES:</td>
              <td className="px-4 py-3 text-right">u$d {totalCosto.toFixed(2)}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right text-[#F05A28]">u$d {totalVenta.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-6 flex justify-end">
        <button 
          onClick={onNext}
          className="bg-[#1B2A47] text-white px-6 py-2 rounded font-semibold hover:bg-[#1B2A47]/90"
          disabled={items.length === 0}
        >
          Siguiente: Preliminar R-04
        </button>
      </div>
    </div>
  )
}
