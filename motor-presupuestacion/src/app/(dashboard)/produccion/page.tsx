import TableroProduccion from '@/components/produccion/TableroProduccion'

// Tablero del circuito: todas las obras en producción y en qué etapa están.
// Cada sector entra acá y ve arriba lo que lo está esperando.

export const dynamic = 'force-dynamic'

export default function ProduccionPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-brand-ink">Producción</h1>
      <p className="mb-6 text-sm text-slate-500">
        Obras con orden de producción emitida, con la etapa en la que están y el sector que tiene
        que mover.
      </p>
      <TableroProduccion />
    </div>
  )
}
