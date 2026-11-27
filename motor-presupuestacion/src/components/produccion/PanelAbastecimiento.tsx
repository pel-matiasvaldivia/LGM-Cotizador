'use client'

import { useState } from 'react'
import { ClipboardCheck, Download, Loader2, PackageCheck, ShoppingCart } from 'lucide-react'
import { Chip, AvisoError } from './PanelMateriales'
import {
  cantidad, fecha, input, label, porSubconjunto,
  type MaterialRow, type OrdenCompraRow,
} from './tipos'

// Pasos 2, 3 y 4 (abastecimiento): verificar el stock, pedir lo que falta y
// registrar el ingreso.
//
// La verificación no es un sí/no por renglón: se carga cuánto hay. De esa
// resta sale la cantidad a comprar, y es la misma que termina en el PDF del
// pedido, sin que nadie la vuelva a calcular a mano.

export default function PanelAbastecimiento({ proyectoId, materiales, ordenesCompra, puede, onCambio }: {
  proyectoId: string
  materiales: MaterialRow[]
  ordenesCompra: OrdenCompraRow[]
  puede: boolean
  onCambio: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const sinVerificar = materiales.some((m) => m.estado === 'pendiente')

  return (
    <div className="space-y-6">
      {sinVerificar
        ? <Verificacion proyectoId={proyectoId} materiales={materiales} puede={puede} onCambio={onCambio} onError={setError} />
        : <Resumen materiales={materiales} />}

      {!sinVerificar && (
        <Compras
          proyectoId={proyectoId}
          materiales={materiales}
          ordenesCompra={ordenesCompra}
          puede={puede}
          onCambio={onCambio}
          onError={setError}
        />
      )}

      {error && <AvisoError texto={error} />}
    </div>
  )
}

/* ─── Verificación de stock ───────────────────────────────────── */

function Verificacion({ proyectoId, materiales, puede, onCambio, onError }: {
  proyectoId: string
  materiales: MaterialRow[]
  puede: boolean
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  // El stock que trajo la exportación del ERP viene cargado de entrada, pero
  // hay que confirmarlo: es el stock general del artículo, no lo reservado
  // para esta obra, y puede estar desactualizado.
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(materiales.map((m) => [
      m.id,
      m.estado !== 'pendiente' ? String(m.cantidad_disponible)
        : m.stock_erp != null ? String(Math.min(m.stock_erp, m.cantidad_requerida))
        : '',
    ])),
  )
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId,
          lineas: materiales.map((m) => ({
            materialId: m.id,
            cantidadDisponible: Number(valores[m.id] || 0),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la verificación')
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al verificar')
    } finally {
      setGuardando(false)
    }
  }

  if (!puede) {
    return (
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Abastecimiento tiene que verificar el stock de los {materiales.length} renglones del
        despiece antes de que el taller pueda arrancar.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-bold text-brand-ink">Verificación de stock</p>
        <p className="text-xs text-slate-500">
          Cargá cuánto hay en depósito de cada renglón. Lo que falte se convierte en el pedido de
          compra de esta obra.
          {materiales.some((m) => m.stock_erp != null) && (
            <> Lo que trajo la exportación del sistema de gestión viene propuesto, acotado a lo que
            hace falta: <strong>confirmalo contra el depósito</strong>, porque es stock general y no
            está reservado para esta obra.</>
          )}
        </p>
      </div>

      {porSubconjunto(materiales).map(([nombre, filas]) => (
        <div key={nombre} className="overflow-hidden rounded-xl border border-slate-200">
          <p className="bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{nombre}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="px-3 py-1">Artículo</th>
                <th className="px-3 py-1 text-right">Necesario</th>
                <th className="px-3 py-1 text-right w-40">Hay en depósito</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => {
                const disp = Number(valores[m.id] || 0)
                const falta = Math.max(m.cantidad_requerida - disp, 0)
                return (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {m.descripcion}
                      {falta > 0 && valores[m.id] !== '' && (
                        <span className="ml-2 text-xs font-semibold text-red-600">
                          faltan {cantidad(falta, m.unidad)}
                        </span>
                      )}
                      {m.stock_erp != null && (
                        <span className="ml-2 text-xs text-slate-400">
                          ERP: {cantidad(m.stock_erp, m.unidad)} en total
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                      {cantidad(m.cantidad_requerida, m.unidad)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={`${input} text-right`}
                        placeholder="0"
                        value={valores[m.id] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [m.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        Guardar verificación
      </button>
    </div>
  )
}

function Resumen({ materiales }: { materiales: MaterialRow[] }) {
  const faltan = materiales.filter((m) => m.cantidad_pendiente > 0)
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tarjeta titulo="Renglones" valor={String(materiales.length)} />
      <Tarjeta titulo="Resueltos" valor={String(materiales.length - faltan.length)} tono="ok" />
      <Tarjeta titulo="Pendientes" valor={String(faltan.length)} tono={faltan.length ? 'alerta' : 'ok'} />
    </div>
  )
}

function Tarjeta({ titulo, valor, tono }: { titulo: string; valor: string; tono?: 'ok' | 'alerta' }) {
  const clase = tono === 'alerta' ? 'text-red-600' : tono === 'ok' ? 'text-emerald-600' : 'text-brand-ink'
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-xl font-bold ${clase}`}>{valor}</p>
    </div>
  )
}

/* ─── Compra e ingreso ────────────────────────────────────────── */

function Compras({ proyectoId, materiales, ordenesCompra, puede, onCambio, onError }: {
  proyectoId: string
  materiales: MaterialRow[]
  ordenesCompra: OrdenCompraRow[]
  puede: boolean
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  const [emitiendo, setEmitiendo] = useState(false)
  const [datos, setDatos] = useState({ fechaNecesidad: '', proveedor: '', notas: '' })

  const pedidos = new Map<string, number>()
  for (const oc of ordenesCompra) {
    if (oc.estado === 'anulada') continue
    for (const i of oc.items) pedidos.set(i.material_id, (pedidos.get(i.material_id) ?? 0) + i.cantidad)
  }
  const sinPedir = materiales.filter((m) => m.cantidad_pendiente - (pedidos.get(m.id) ?? 0) > 0.0001)
  const porRecibir = materiales.filter((m) => m.cantidad_pendiente > 0.0001 && (pedidos.get(m.id) ?? 0) > 0)

  const emitir = async () => {
    setEmitiendo(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/orden-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, ...datos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo emitir el pedido')
      setDatos({ fechaNecesidad: '', proveedor: '', notas: '' })
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al emitir el pedido')
    } finally {
      setEmitiendo(false)
    }
  }

  return (
    <div className="space-y-4">
      {sinPedir.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">
            Faltan {sinPedir.length} renglones sin pedir
          </p>
          <ul className="mt-2 space-y-0.5 text-sm text-amber-900">
            {sinPedir.slice(0, 6).map((m) => (
              <li key={m.id}>
                {m.descripcion} — <strong>{cantidad(m.cantidad_pendiente - (pedidos.get(m.id) ?? 0), m.unidad)}</strong>
              </li>
            ))}
            {sinPedir.length > 6 && <li className="text-xs">y {sinPedir.length - 6} más</li>}
          </ul>

          {puede && (
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className={label}>Necesario para</span>
                  <input
                    type="date"
                    className={input}
                    value={datos.fechaNecesidad}
                    onChange={(e) => setDatos({ ...datos, fechaNecesidad: e.target.value })}
                  />
                </div>
                <div>
                  <span className={label}>Proveedor sugerido</span>
                  <input
                    className={input}
                    placeholder="Opcional"
                    value={datos.proveedor}
                    onChange={(e) => setDatos({ ...datos, proveedor: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={emitir}
                disabled={emitiendo}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {emitiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Generar pedido de materiales
              </button>
            </div>
          )}
        </div>
      )}

      {ordenesCompra.map((oc) => (
        <OrdenCompra key={oc.id} oc={oc} materiales={materiales} puede={puede} onCambio={onCambio} onError={onError} />
      ))}

      {porRecibir.length > 0 && puede && (
        <Ingresos
          proyectoId={proyectoId}
          materiales={porRecibir}
          ordenesCompra={ordenesCompra}
          onCambio={onCambio}
          onError={onError}
        />
      )}
    </div>
  )
}

const ESTADO_OC: Record<OrdenCompraRow['estado'], { texto: string; clase: string }> = {
  borrador: { texto: 'Sin cursar', clase: 'bg-slate-100 text-slate-600' },
  pedida: { texto: 'Pedida', clase: 'bg-amber-100 text-amber-700' },
  recibida_parcial: { texto: 'Ingreso parcial', clase: 'bg-amber-100 text-amber-700' },
  recibida: { texto: 'Completa', clase: 'bg-emerald-100 text-emerald-700' },
  anulada: { texto: 'Anulada', clase: 'bg-slate-100 text-slate-400' },
}

function OrdenCompra({ oc, materiales, puede, onCambio, onError }: {
  oc: OrdenCompraRow
  materiales: MaterialRow[]
  puede: boolean
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const porId = new Map(materiales.map((m) => [m.id, m]))
  const chip = ESTADO_OC[oc.estado]

  const cursar = async () => {
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/orden-compra', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenCompraId: oc.id, referenciaErp: referencia }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo marcar como cursada')
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al cursar el pedido')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-brand-ink">{oc.numero}</p>
          <p className="text-xs text-slate-500">
            {oc.items.length} renglones
            {oc.fecha_necesidad ? ` · necesario para ${fecha(oc.fecha_necesidad)}` : ''}
            {oc.referencia_erp ? ` · ERP ${oc.referencia_erp}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip.clase}`}>{chip.texto}</span>
          <a
            href={`/api/produccion/orden-compra?ordenCompraId=${oc.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </a>
        </div>
      </div>

      <ul className="space-y-0.5 text-sm text-slate-600">
        {oc.items.map((i) => {
          const m = porId.get(i.material_id)
          return (
            <li key={i.id} className="flex justify-between gap-4">
              <span>{m?.descripcion ?? '—'}</span>
              <span className="whitespace-nowrap">
                {cantidad(i.cantidad_recibida, m?.unidad)} / {cantidad(i.cantidad, m?.unidad)}
              </span>
            </li>
          )
        })}
      </ul>

      {oc.estado === 'borrador' && puede && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-48">
            <span className={label}>Número en el sistema de gestión</span>
            <input
              className={input}
              placeholder="Opcional"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={cursar}
            disabled={guardando}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Marcar como pedida'}
          </button>
        </div>
      )}
    </div>
  )
}

function Ingresos({ proyectoId, materiales, ordenesCompra, onCambio, onError }: {
  proyectoId: string
  materiales: MaterialRow[]
  ordenesCompra: OrdenCompraRow[]
  onCambio: () => void
  onError: (e: string | null) => void
}) {
  const [materialId, setMaterialId] = useState(materiales[0]?.id ?? '')
  const [monto, setMonto] = useState('')
  const [remito, setRemito] = useState('')
  const [guardando, setGuardando] = useState(false)

  const material = materiales.find((m) => m.id === materialId)
  const ocDelMaterial = ordenesCompra.find(
    (oc) => oc.estado !== 'anulada' && oc.items.some((i) => i.material_id === materialId),
  )

  const registrar = async () => {
    setGuardando(true)
    onError(null)
    try {
      const res = await fetch('/api/produccion/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId,
          materialId,
          cantidad: Number(monto),
          remitoProveedor: remito,
          ordenCompraId: ocDelMaterial?.id ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el ingreso')
      setMonto('')
      setRemito('')
      onCambio()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error al registrar el ingreso')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-1 font-bold text-brand-ink">Registrar ingreso de material</p>
      <p className="mb-3 text-xs text-slate-500">
        Un renglón por remito del proveedor. Los ingresos se suman: si entra en dos viajes, se
        cargan los dos.
      </p>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <span className={label}>Material</span>
          <select className={input} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {materiales.map((m) => (
              <option key={m.id} value={m.id}>
                {m.descripcion} — faltan {cantidad(m.cantidad_pendiente, m.unidad)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={label}>Cantidad{material ? ` (${material.unidad})` : ''}</span>
          <input
            type="number"
            min="0"
            step="any"
            className={input}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div>
          <span className={label}>Remito</span>
          <input className={input} value={remito} onChange={(e) => setRemito(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={registrar}
          disabled={guardando || !monto}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
          Ingresar
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {materiales.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>{m.descripcion}</span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              {cantidad(m.cantidad_disponible + m.cantidad_recibida, m.unidad)} de {cantidad(m.cantidad_requerida, m.unidad)}
              <Chip estado={m.estado} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
