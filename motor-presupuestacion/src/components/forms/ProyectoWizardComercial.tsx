'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Factory, Home, CheckCircle2, Loader2,
  ChevronRight, Ruler, ToggleLeft, User, Info, ListChecks, ClipboardList,
} from 'lucide-react'
import SelectorRubros from './SelectorRubros'

const TIPOLOGIAS = [
  { id: 'ALVEOLAR', title: 'Alveolar', desc: 'Liviana, sin columnas centrales. Depósitos y galpones medianos.', icon: <Building2 className="mb-3 h-10 w-10" /> },
  { id: 'ALMA_LLENA', title: 'Alma Llena', desc: 'Pesada, para naves altas y puentes grúa.', icon: <Factory className="mb-3 h-10 w-10" /> },
  { id: 'RETICULADA', title: 'Reticulada', desc: 'Para campos y logística estándar.', icon: <Home className="mb-3 h-10 w-10" /> },
]

const CUBIERTAS = [
  { id: 'CHAPA_TRAPEZOIDAL', title: 'Chapa Trapezoidal 25/75', desc: 'Económica, ideal para climas secos.' },
  { id: 'PANEL_SANDWICH', title: 'Panel Sandwich 50mm', desc: 'Aislación térmica/acústica superior.' },
]

// Steps: 0=Bienvenida 1=Tipología 2=Dimensiones 3=Cubierta 4=Alcance 5=Rubros 6=Contacto 7=Listo
const TOTAL_STEPS = 8
// Pasos "llenables" que se muestran en la barra de progreso (1..6)
const PASOS_LLENABLES = 6

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i < current ? 'bg-[#F05A28]' : i === current ? 'bg-[#F05A28]/50' : 'bg-gray-200'
          } ${i === current ? 'flex-[2]' : 'flex-1'}`} />
      ))}
    </div>
  )
}

function SelectionCard({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick}
      className={`relative cursor-pointer border-2 rounded-2xl p-5 transition-all hover:border-[#F05A28] hover:shadow-lg ${
        selected ? 'border-[#F05A28] bg-orange-50 shadow-md' : 'border-gray-100 bg-white'
      }`}>
      {children}
      {selected && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-[#F05A28]" /></div>}
    </div>
  )
}

function ToggleRow({ active, onToggle, title, desc }: { active: boolean; onToggle: () => void; title: string; desc: string }) {
  return (
    <div onClick={onToggle}
      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${active ? 'border-[#F05A28] bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}>
      <div className="pr-4">
        <p className="font-semibold text-[#1B2A47]">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${active ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
        <div className="w-4 h-4 bg-white rounded-full shadow" />
      </div>
    </div>
  )
}

function PriceBadge({ price, loading }: { price: number | null; loading: boolean }) {
  if (price === null && !loading) return null
  return loading ? (
    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
      <span className="text-sm text-slate-400 font-medium">Calculando…</span>
    </div>
  ) : price !== null && price > 0 ? (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
      <div>
        <p className="text-xs text-emerald-600 font-semibold leading-tight">Costo estimado</p>
        <p className="text-lg font-extrabold text-emerald-700 leading-tight">
          USD {price.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  ) : null
}

// Arma el payload de datos técnicos para estimate/calculate a partir del formData.
function armarDatosTecnicos(data: Record<string, any>) {
  const ancho = Number(data.ancho_m) || 0
  const largo = Number(data.largo_m) || 0
  return {
    ...data,
    ancho_m: ancho,
    largo_m: largo,
    superficie_m2: ancho * largo,
    tipo_cubierta: data.tipo_cubierta || 'CHAPA_TRAPEZOIDAL',
    incluye_fabricacion: data.incluye_fabricacion ?? true,
    incluye_montaje: data.incluye_montaje ?? true,
    incluye_cubierta: data.incluye_cubierta ?? true,
    incluye_cerramiento_lateral: data.incluye_cerramiento_lateral ?? false,
    incluye_portones: data.incluye_portones ?? false,
    incluye_piso_industrial: data.incluye_piso_industrial ?? false,
    incluye_instalacion_electrica: data.incluye_instalacion_electrica ?? false,
    incluye_instalacion_sanitaria: data.incluye_instalacion_sanitaria ?? false,
    cantidad_portones: Number(data.cantidad_portones) || 1,
    incluye_oficina: data.incluye_oficina ?? false,
    oficina_ancho_m: Number(data.oficina_ancho_m) || 0,
    oficina_largo_m: Number(data.oficina_largo_m) || 0,
    oficina_planta_alta: data.oficina_planta_alta ?? false,
    incluye_bano: data.incluye_bano ?? false,
    cantidad_banos: Number(data.cantidad_banos) || 1,
    cliente: `${data.cliente_nombre || ''} ${data.cliente_apellido || ''}`.trim() || data.cliente_empresa || 'Sin nombre',
    ubicacion: data.ubicacion_obra || '',
    subrubros_seleccionados: data.subrubros_seleccionados,
  }
}

export default function ProyectoWizardComercial() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>({
    tipologia: '',
    ancho_m: '',
    largo_m: '',
    altura_libre_m: '',
    tipo_cubierta: 'CHAPA_TRAPEZOIDAL',
    tipo_cerramiento: 'CHAPA',
    incluye_cubierta: true,
    incluye_fabricacion: true,
    incluye_montaje: true,
    incluye_cerramiento_lateral: false,
    incluye_portones: false,
    cantidad_portones: 1,
    incluye_piso_industrial: false,
    incluye_instalacion_electrica: false,
    incluye_instalacion_sanitaria: false,
    incluye_oficina: false,
    oficina_ancho_m: '',
    oficina_largo_m: '',
    oficina_planta_alta: false,
    incluye_bano: false,
    cantidad_banos: 1,
    ubicacion_obra: '',
    cliente_nombre: '',
    cliente_apellido: '',
    cliente_dni: '',
    cliente_empresa: '',
    cliente_email: '',
    cliente_telefono: '',
    observaciones: '',
    subrubros_seleccionados: undefined as string[] | undefined,
  })

  const [submitting, setSubmitting] = useState(false)
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [proyectoCreado, setProyectoCreado] = useState<{ id: string; codigo: string } | null>(null)
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nextStep = () => setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1))
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 0))
  const set = (field: string, value: any) => setFormData((prev) => ({ ...prev, [field]: value }))
  const handleSelect = (field: string, value: any) => { set(field, value); setTimeout(nextStep, 200) }

  const requestEstimate = useCallback((data: Record<string, any>) => {
    const superficie = (Number(data.ancho_m) || 0) * (Number(data.largo_m) || 0)
    if (!data.tipologia || superficie <= 0) return
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current)
    setEstimating(true)
    estimateTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datosTecnicos: armarDatosTecnicos(data) }),
        })
        const result = await res.json()
        setEstimatedPrice(result.totalVentaUSD || result.totalCostoUSD || 0)
      } catch {
        // silencioso
      } finally {
        setEstimating(false)
      }
    }, 500)
  }, [])

  useEffect(() => {
    if (step >= 2) requestEstimate(formData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.tipologia, formData.ancho_m, formData.largo_m, formData.tipo_cubierta,
    formData.incluye_montaje, formData.incluye_oficina, formData.oficina_ancho_m,
    formData.oficina_largo_m, formData.oficina_planta_alta, formData.incluye_bano,
    formData.cantidad_banos, formData.incluye_instalacion_electrica, formData.incluye_portones,
    formData.cantidad_portones, formData.subrubros_seleccionados, step,
  ])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const datosTecnicos = armarDatosTecnicos(formData)
      const createRes = await fetch('/api/proyectos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: 'manual', variables: datosTecnicos }),
      })
      const created = await createRes.json()
      if (created.error) throw new Error(created.error)

      await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId: created.proyectoId, datosTecnicos }),
      })

      setProyectoCreado({ id: created.proyectoId, codigo: created.codigo })
      nextStep()
    } catch (err: any) {
      alert('Ocurrió un error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const showPrice = step >= 2 && step < TOTAL_STEPS - 1 && (estimatedPrice !== null || estimating)
  const inputClass = 'w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none transition-shadow text-[#1B2A47]'
  const labelClass = 'block text-sm font-semibold text-slate-600 mb-2'
  const btnSecondary = 'flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors'
  const slideProps = {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
    transition: { duration: 0.25, ease: 'easeOut' as const },
  }
  const nSel = (formData.subrubros_seleccionados?.length ?? 0)

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col border border-gray-100" style={{ minHeight: 560 }}>

      {/* HEADER */}
      <div className="bg-slate-50 px-8 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[#1B2A47] font-bold">
            <ClipboardList className="w-5 h-5 text-[#F05A28]" /> Carga manual de proyecto
          </div>
          <div className="flex items-center gap-3">
            {showPrice && <PriceBadge price={estimatedPrice} loading={estimating} />}
            <div className="text-sm text-gray-400 font-medium">
              {step === 0 || step === TOTAL_STEPS - 1 ? '' : `Paso ${step} de ${PASOS_LLENABLES}`}
            </div>
          </div>
        </div>
        {step > 0 && step < TOTAL_STEPS - 1 && <ProgressBar current={step - 1} total={PASOS_LLENABLES} />}
      </div>

      <div className="flex-1 relative overflow-hidden bg-white">
        <AnimatePresence mode="wait">

          {/* STEP 0: BIENVENIDA / CARGA MANUAL */}
          {step === 0 && (
            <motion.div key="s0" {...slideProps} className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6 min-h-[460px]">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-2">
                <ClipboardList className="w-8 h-8 text-[#F05A28]" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#1B2A47] leading-tight">Cargá el proyecto a mano</h2>
              <p className="text-slate-500 max-w-md text-lg">
                Un asistente guiado para relevar la estructura, elegir los rubros y subrubros del catálogo
                y generar el proyecto con su presupuesto Base 0.
              </p>
              <button onClick={nextStep}
                className="mt-4 bg-[#F05A28] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition-all shadow-xl hover:scale-105">
                Carga Manual <ChevronRight className="inline" />
              </button>
            </motion.div>
          )}

          {/* STEP 1: TIPOLOGÍA */}
          {step === 1 && (
            <motion.div key="s1" {...slideProps} className="p-8 min-h-[460px] flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-[#1B2A47] mb-2 text-center">¿Qué tipo de estructura?</h2>
              <p className="text-slate-500 text-center text-sm mb-6">Seleccioná el sistema estructural de la nave</p>
              <div className="grid md:grid-cols-3 gap-4">
                {TIPOLOGIAS.map((t) => (
                  <SelectionCard key={t.id} selected={formData.tipologia === t.id} onClick={() => handleSelect('tipologia', t.id)}>
                    <div className={`flex justify-center ${formData.tipologia === t.id ? 'text-[#F05A28]' : 'text-[#1B2A47]'}`}>{t.icon}</div>
                    <h3 className="font-bold text-lg mb-1 text-center">{t.title}</h3>
                    <p className="text-xs text-gray-500 text-center">{t.desc}</p>
                  </SelectionCard>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} disabled={!formData.tipologia}
                  className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700 disabled:opacity-40">
                  Continuar <ChevronRight className="inline" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: DIMENSIONES + UBICACIÓN */}
          {step === 2 && (
            <motion.div key="s2" {...slideProps} className="p-8 min-h-[460px] flex flex-col justify-center max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Ruler className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Dimensiones de la nave</h2>
                  <p className="text-slate-500 text-sm">Tipología: <strong>{formData.tipologia}</strong></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Ancho (m) *</label>
                  <input type="number" value={formData.ancho_m} onChange={(e) => set('ancho_m', e.target.value)} className={inputClass} placeholder="Ej: 20" min="0" />
                </div>
                <div>
                  <label className={labelClass}>Largo (m) *</label>
                  <input type="number" value={formData.largo_m} onChange={(e) => set('largo_m', e.target.value)} className={inputClass} placeholder="Ej: 50" min="0" />
                </div>
              </div>
              <div className="mb-4">
                <label className={labelClass}>Altura libre interior (m) *</label>
                <input type="number" value={formData.altura_libre_m} onChange={(e) => set('altura_libre_m', e.target.value)} className={inputClass} placeholder="Ej: 8" min="0" step="0.5" />
              </div>
              <div className="mb-4">
                <label className={labelClass}>Dirección exacta de la obra</label>
                <input type="text" value={formData.ubicacion_obra} onChange={(e) => set('ubicacion_obra', e.target.value)} className={inputClass} placeholder="Ruta, km, parque industrial, ciudad, provincia" />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} disabled={!formData.ancho_m || !formData.largo_m || !formData.altura_libre_m}
                  className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700 disabled:opacity-40">
                  Continuar <ChevronRight className="inline" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CUBIERTA */}
          {step === 3 && (
            <motion.div key="s3" {...slideProps} className="p-8 min-h-[460px] flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-[#1B2A47] mb-2">Tipo de cubierta</h2>
              <p className="text-slate-500 text-sm mb-6">Material del techo de la nave</p>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {CUBIERTAS.map((c) => (
                  <SelectionCard key={c.id} selected={formData.tipo_cubierta === c.id} onClick={() => set('tipo_cubierta', c.id)}>
                    <h3 className="font-bold text-base mb-1">{c.title}</h3>
                    <p className="text-xs text-gray-500">{c.desc}</p>
                  </SelectionCard>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700">Continuar <ChevronRight className="inline" /></button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: ALCANCE (montaje + cantidades de módulos) */}
          {step === 4 && (
            <motion.div key="s4" {...slideProps} className="p-8 min-h-[460px] flex flex-col justify-center max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><ToggleLeft className="w-5 h-5 text-green-600" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Alcance y cantidades</h2>
                  <p className="text-slate-500 text-sm">Definí montaje y las medidas de los módulos. En el próximo paso elegís los rubros.</p>
                </div>
              </div>
              <div className="space-y-3">
                <ToggleRow active={formData.incluye_montaje} onToggle={() => set('incluye_montaje', !formData.incluye_montaje)}
                  title="Montaje en obra" desc="Si no se incluye, se descuenta la MO de montaje de cada línea." />

                {/* Oficina */}
                <div className={`rounded-xl border-2 transition-all ${formData.incluye_oficina ? 'border-[#F05A28]' : 'border-gray-100'}`}>
                  <div onClick={() => set('incluye_oficina', !formData.incluye_oficina)}
                    className={`flex items-center justify-between p-4 cursor-pointer ${formData.incluye_oficina ? 'bg-orange-50 rounded-t-xl' : 'rounded-xl hover:border-gray-300'}`}>
                    <div className="pr-4">
                      <p className="font-semibold text-[#1B2A47]">Oficina interior</p>
                      <p className="text-xs text-gray-500">Medidas para calcular tabiques, revestimientos y obra civil.</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${formData.incluye_oficina ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
                      <div className="w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  </div>
                  {formData.incluye_oficina && (
                    <div className="p-4 pt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Ancho oficina (m)</label>
                          <input type="number" min="0" value={formData.oficina_ancho_m} onChange={(e) => set('oficina_ancho_m', e.target.value)} className={inputClass} placeholder="Ej: 5" />
                        </div>
                        <div>
                          <label className={labelClass}>Largo oficina (m)</label>
                          <input type="number" min="0" value={formData.oficina_largo_m} onChange={(e) => set('oficina_largo_m', e.target.value)} className={inputClass} placeholder="Ej: 8" />
                        </div>
                      </div>
                      <ToggleRow active={formData.oficina_planta_alta} onToggle={() => set('oficina_planta_alta', !formData.oficina_planta_alta)}
                        title="Con planta alta (entrepiso)" desc="Duplica la superficie de oficina y agrega escalera." />
                    </div>
                  )}
                </div>

                {/* Baño */}
                <div className={`rounded-xl border-2 transition-all ${formData.incluye_bano ? 'border-[#F05A28]' : 'border-gray-100'}`}>
                  <div onClick={() => set('incluye_bano', !formData.incluye_bano)}
                    className={`flex items-center justify-between p-4 cursor-pointer ${formData.incluye_bano ? 'bg-orange-50 rounded-t-xl' : 'rounded-xl hover:border-gray-300'}`}>
                    <div className="pr-4">
                      <p className="font-semibold text-[#1B2A47]">Baño interior</p>
                      <p className="text-xs text-gray-500">Cantidad para la instalación sanitaria.</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${formData.incluye_bano ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
                      <div className="w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  </div>
                  {formData.incluye_bano && (
                    <div className="p-4 pt-2">
                      <label className={labelClass}>Cantidad de baños</label>
                      <input type="number" min="1" value={formData.cantidad_banos} onChange={(e) => set('cantidad_banos', e.target.value)} className={inputClass} placeholder="1" />
                    </div>
                  )}
                </div>

                <ToggleRow active={formData.incluye_portones} onToggle={() => set('incluye_portones', !formData.incluye_portones)}
                  title="Portones" desc="Cantidad de portones corredizos metálicos." />
                {formData.incluye_portones && (
                  <div className="px-1">
                    <label className={labelClass}>Cantidad de portones</label>
                    <input type="number" min="1" value={formData.cantidad_portones} onChange={(e) => set('cantidad_portones', e.target.value)} className={inputClass} placeholder="1" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700">Continuar <ChevronRight className="inline" /></button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: RUBROS Y SUBRUBROS */}
          {step === 5 && (
            <motion.div key="s5" {...slideProps} className="p-8 min-h-[460px] flex flex-col justify-center max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><ListChecks className="w-5 h-5 text-amber-600" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Rubros y subrubros</h2>
                  <p className="text-slate-500 text-sm">Activá o desactivá exactamente lo que entra en esta cotización.</p>
                </div>
              </div>
              <SelectorRubros
                seleccionados={formData.subrubros_seleccionados}
                onChange={(ids) => set('subrubros_seleccionados', ids)}
              />
              <div className="flex items-start gap-2 mt-4 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                <span>Lo que dejes marcado manda sobre el alcance automático: se genera una línea Base 0 por cada subrubro. Después podés editar cantidad/material/mano de obra por línea en el proyecto.</span>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} disabled={nSel === 0}
                  className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700 disabled:opacity-40">
                  Continuar ({nSel}) <ChevronRight className="inline" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 6: CONTACTO + GENERAR */}
          {step === 6 && (
            <motion.div key="s6" {...slideProps} className="p-8 min-h-[460px] flex flex-col justify-center max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><User className="w-5 h-5 text-purple-600" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Datos del cliente</h2>
                  <p className="text-slate-500 text-sm">Se le enviará la bienvenida al proceso de cotización.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input type="text" value={formData.cliente_nombre} onChange={(e) => set('cliente_nombre', e.target.value)} className={inputClass} placeholder="Juan" />
                </div>
                <div>
                  <label className={labelClass}>Apellido *</label>
                  <input type="text" value={formData.cliente_apellido} onChange={(e) => set('cliente_apellido', e.target.value)} className={inputClass} placeholder="García" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>DNI / CUIT</label>
                  <input type="text" value={formData.cliente_dni} onChange={(e) => set('cliente_dni', e.target.value)} className={inputClass} placeholder="30.123.456" />
                </div>
                <div>
                  <label className={labelClass}>Empresa / Razón social</label>
                  <input type="text" value={formData.cliente_empresa} onChange={(e) => set('cliente_empresa', e.target.value)} className={inputClass} placeholder="Mi Empresa SRL" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" value={formData.cliente_email} onChange={(e) => set('cliente_email', e.target.value)} className={inputClass} placeholder="cliente@empresa.com" />
                </div>
                <div>
                  <label className={labelClass}>Teléfono / WhatsApp</label>
                  <input type="tel" value={formData.cliente_telefono} onChange={(e) => set('cliente_telefono', e.target.value)} className={inputClass} placeholder="+54 9 261 xxx-xxxx" />
                </div>
              </div>
              <div className="mb-5">
                <label className={labelClass}>Observaciones</label>
                <textarea value={formData.observaciones} onChange={(e) => set('observaciones', e.target.value)} className={`${inputClass} resize-none`} rows={2} placeholder="Notas internas o del relevamiento" />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm text-slate-600">
                <p className="font-bold text-[#1B2A47] mb-2">Resumen</p>
                <div className="grid grid-cols-2 gap-1">
                  <span>Tipología:</span><span className="font-semibold">{formData.tipologia}</span>
                  <span>Dimensiones:</span><span className="font-semibold">{formData.ancho_m}m × {formData.largo_m}m × {formData.altura_libre_m}m</span>
                  <span>Superficie:</span><span className="font-semibold">{(Number(formData.ancho_m) * Number(formData.largo_m)).toFixed(0)} m²</span>
                  <span>Cubierta:</span><span className="font-semibold">{formData.tipo_cubierta?.replace(/_/g, ' ')}</span>
                  <span>Subrubros elegidos:</span><span className="font-semibold">{nSel}</span>
                  {estimatedPrice !== null && estimatedPrice > 0 && (
                    <><span>Costo estimado:</span><span className="font-bold text-emerald-600">USD {estimatedPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={prevStep} className={btnSecondary} disabled={submitting}>Atrás</button>
                <button onClick={handleSubmit}
                  disabled={submitting || !formData.cliente_nombre || !formData.cliente_apellido || !formData.cliente_email}
                  className="flex-1 bg-[#F05A28] text-white py-4 rounded-xl font-bold text-base hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-orange-200">
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando…</> : <>Generar proyecto y Base 0</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: LISTO */}
          {step === 7 && (
            <motion.div key="s7" {...slideProps} className="p-10 min-h-[460px] flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-[#1B2A47] mb-2">Proyecto generado</h2>
              {proyectoCreado && <p className="text-lg text-slate-600 mb-1">Código <strong className="text-[#1B2A47]">{proyectoCreado.codigo}</strong></p>}
              <p className="text-slate-500 mb-8 max-w-sm">
                El presupuesto Base 0 se calculó con los subrubros elegidos. Abrí el proyecto para revisarlo,
                editar líneas y enviarlo al cliente.
              </p>
              <div className="flex gap-3">
                <button onClick={() => router.push('/proyectos')} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-200">
                  Ir a Proyectos
                </button>
                {proyectoCreado && (
                  <button onClick={() => router.push(`/proyectos/${proyectoCreado.id}`)}
                    className="bg-[#1B2A47] text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-700">
                    Abrir proyecto →
                  </button>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
