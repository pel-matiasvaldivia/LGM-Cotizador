'use client'

import { useState } from 'react'
import { Download, FileText, Calculator, Loader2, ArrowLeft, User, MapPin, Building2, Send } from 'lucide-react'
import Link from 'next/link'

type Tab = 'base0' | 'cliente'

export default function ProyectoDetalle({
  proyecto,
  datosTecnicos,
  initialItems,
}: {
  proyecto: any
  datosTecnicos: any
  initialItems: any[]
}) {
  const [tab, setTab] = useState<Tab>('base0')
  const [items, setItems] = useState<any[]>(initialItems)
  const [downloading, setDownloading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  const updateMargen = (index: number, newMargen: number) => {
    const updated = [...items]
    updated[index].margen = newMargen
    updated[index].precio_venta_usd = updated[index].costo_total_usd * (1 + newMargen)
    updated[index].precio_venta_ars = updated[index].costo_total_ars * (1 + newMargen)
    setItems(updated)
  }

  const handleRecalculate = async () => {
    if (!datosTecnicos) return
    setRecalculating(true)
    try {
      const dt = {
        superficie_m2: datosTecnicos.superficie,
        tipologia: datosTecnicos.tipologia,
        tipo_cubierta: datosTecnicos.tipo_cubierta,
        incluye_fabricacion: datosTecnicos.incluye_fabricacion,
        incluye_montaje: datosTecnicos.incluye_montaje,
        incluye_cubierta: datosTecnicos.incluye_cubierta,
        incluye_cerramiento_lateral: datosTecnicos.incluye_cerramiento_lateral,
        incluye_portones: datosTecnicos.incluye_portones,
        incluye_piso_industrial: datosTecnicos.incluye_piso,
        incluye_instalacion_electrica: datosTecnicos.incluye_electrica,
        incluye_instalacion_sanitaria: datosTecnicos.incluye_sanitaria,
        cantidad_portones: datosTecnicos.cantidad_portones,
      }
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId: proyecto.id, datosTecnicos: dt }),
      })
      const data = await res.json()
      if (data.items) setItems(data.items)
    } finally {
      setRecalculating(false)
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/export?proyectoId=${proyecto.id}`)
      if (!res.ok) throw new Error('Error generando PDF')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `R04_${proyecto.codigo}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error generando PDF: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  const totalCostoUSD = items.reduce((s, i) => s + (i.costo_total_usd || 0), 0)
  const totalVentaUSD = items.reduce((s, i) => s + (i.precio_venta_usd || 0), 0)
  const ivaUSD = totalVentaUSD * 0.21
  const totalConIVA = totalVentaUSD + ivaUSD

  const estadoColors: Record<string, string> = {
    borrador:    'bg-slate-100 text-slate-600',
    enviado:     'bg-blue-100 text-blue-700',
    preaprobado: 'bg-amber-100 text-amber-700',
    aprobado:    'bg-emerald-100 text-emerald-700',
  }

  const estadoLabels: Record<string, string> = {
    borrador:    'Borrador',
    enviado:     'Enviado',
    preaprobado: 'Preaprobado',
    aprobado:    'Aprobado',
  }

  return (
    <div className="max-w-6xl mx-auto p-6">

      {/* Cabecera */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/proyectos" className="text-slate-400 hover:text-[#1B2A47] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1B2A47]">{proyecto.codigo}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${estadoColors[proyecto.estado] || 'bg-gray-100 text-gray-700'}`}>
                {estadoLabels[proyecto.estado] ?? proyecto.estado}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              {new Date(proyecto.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={downloading || items.length === 0}
          className="flex items-center gap-2 bg-[#F05A28] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-40 shadow-md shadow-orange-200"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar R-04
        </button>
      </div>

      {/* Datos del cliente y proyecto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <User className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Cliente</span>
          </div>
          <p className="font-bold text-[#1B2A47] text-lg">{proyecto.cliente}</p>
          {proyecto.razon_social && <p className="text-sm text-slate-500">{proyecto.razon_social}</p>}
          {proyecto.dni && <p className="text-xs text-slate-400 mt-1">DNI: {proyecto.dni}</p>}
          {proyecto.email && <p className="text-xs text-slate-400">{proyecto.email}</p>}
          {proyecto.telefono && <p className="text-xs text-slate-400">{proyecto.telefono}</p>}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Estructura</span>
          </div>
          {datosTecnicos ? (
            <>
              <p className="font-bold text-[#1B2A47] text-lg">{datosTecnicos.tipologia?.replace(/_/g, ' ')}</p>
              <p className="text-sm text-slate-500">{datosTecnicos.ancho}m × {datosTecnicos.largo}m × {datosTecnicos.altura_libre}m alt.</p>
              <p className="text-sm font-semibold text-slate-600 mt-1">{datosTecnicos.superficie} m²</p>
              <p className="text-xs text-slate-400 mt-1">{datosTecnicos.tipo_cubierta?.replace(/_/g, ' ')}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Sin datos técnicos</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <MapPin className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Ubicación</span>
          </div>
          <p className="font-bold text-[#1B2A47]">{proyecto.ubicacion || '—'}</p>
          <p className="text-xs text-slate-400 mt-2">Canal: <span className="capitalize">{proyecto.canal_origen?.replace(/_/g, ' ')}</span></p>
          {proyecto.observaciones && (
            <p className="text-xs text-slate-500 mt-2 italic">"{proyecto.observaciones}"</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('base0')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'base0' ? 'bg-white text-[#1B2A47] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Presupuesto Base 0
        </button>
        <button
          onClick={() => setTab('cliente')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            tab === 'cliente' ? 'bg-white text-[#1B2A47] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Presupuesto Cliente
        </button>
      </div>

      {/* TAB: BASE 0 (INTERNO) */}
      {tab === 'base0' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-[#1B2A47]">Presupuesto Base 0 — Interno</h2>
              <p className="text-xs text-slate-400 mt-0.5">Costo real de la empresa. No se comparte con el cliente.</p>
            </div>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-2 text-sm bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200 transition-colors disabled:opacity-40"
            >
              {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
              Recalcular
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-[#1B2A47] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Descripción</th>
                  <th className="px-4 py-3 font-semibold text-center">Cantidad</th>
                  <th className="px-4 py-3 font-semibold text-right">Costo USD</th>
                  <th className="px-4 py-3 font-semibold text-center w-32">Margen (%)</th>
                  <th className="px-4 py-3 font-semibold text-right">Venta USD</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      No hay ítems calculados. Presioná <strong>Recalcular</strong>.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className={`border-b border-gray-50 hover:bg-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-3">{item.descripcion || '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{Number(item.cantidad || 0).toFixed(1)} {item.unidad}</td>
                      <td className="px-4 py-3 text-right">USD {Number(item.costo_total_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="2"
                          className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-center text-sm focus:ring-2 focus:ring-[#F05A28] outline-none"
                          value={Number(item.margen || 0.2).toFixed(2)}
                          onChange={e => updateMargen(idx, parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1B2A47]">USD {Number(item.precio_venta_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right text-slate-600">Total Costo:</td>
                    <td className="px-4 py-3 text-right">USD {totalCostoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td />
                    <td className="px-4 py-3 text-right text-[#F05A28] text-base">USD {totalVentaUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB: PRESUPUESTO CLIENTE */}
      {tab === 'cliente' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-[#1B2A47]">Presupuesto para el Cliente</h2>
              <p className="text-xs text-slate-400 mt-0.5">Vista previa del R-04 que recibirá el cliente.</p>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading || items.length === 0}
              className="flex items-center gap-2 bg-[#F05A28] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-40 shadow-sm"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar PDF R-04
            </button>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sin ítems de presupuesto. Calculá desde la pestaña Base 0.</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Header del R-04 */}
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Presupuesto</p>
                  <p className="text-2xl font-extrabold text-[#1B2A47]">{proyecto.codigo}</p>
                  <p className="text-sm text-slate-500 mt-1">{new Date().toLocaleDateString('es-AR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1B2A47]">{proyecto.cliente}</p>
                  {proyecto.razon_social && <p className="text-sm text-slate-500">{proyecto.razon_social}</p>}
                  <p className="text-sm text-slate-400">{proyecto.ubicacion}</p>
                </div>
              </div>

              {/* Tabla de ítems para el cliente (sin mostrar costos internos) */}
              <table className="w-full text-left text-sm mb-6">
                <thead>
                  <tr className="border-b-2 border-[#1B2A47]">
                    <th className="py-2 font-bold text-[#1B2A47]">Descripción</th>
                    <th className="py-2 font-bold text-[#1B2A47] text-center">Cantidad</th>
                    <th className="py-2 font-bold text-[#1B2A47] text-right">Precio Unit. USD</th>
                    <th className="py-2 font-bold text-[#1B2A47] text-right">Subtotal USD</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className={`border-b border-gray-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-2.5 text-slate-700">{item.descripcion}</td>
                      <td className="py-2.5 text-center text-slate-500">{Number(item.cantidad || 0).toFixed(1)} {item.unidad}</td>
                      <td className="py-2.5 text-right text-slate-600">USD {Number(item.precio_unitario_usd || 0).toFixed(2)}</td>
                      <td className="py-2.5 text-right font-semibold text-[#1B2A47]">USD {Number(item.precio_venta_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totales */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal sin IVA:</span>
                    <span className="font-semibold">USD {totalVentaUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>IVA (21%):</span>
                    <span>USD {ivaUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[#1B2A47] border-t border-gray-200 pt-2">
                    <span>TOTAL CON IVA:</span>
                    <span className="text-[#F05A28]">USD {totalConIVA.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-6 text-center">
                Validez de la oferta: 15 días · Valores en dólares estadounidenses
              </p>

              <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                <button
                  disabled
                  className="flex items-center gap-2 bg-[#1B2A47] text-white px-6 py-3 rounded-xl font-bold text-sm opacity-60 cursor-not-allowed"
                  title="Próximamente"
                >
                  <Send className="w-4 h-4" />
                  Enviar presupuesto al cliente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
