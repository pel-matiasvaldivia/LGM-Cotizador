'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Factory, Home, CheckCircle2, UploadCloud, Loader2,
  Check, ChevronRight, Ruler, ToggleLeft, User, CalendarCheck, Info, ShieldCheck
} from 'lucide-react'
import ClientAuthStep from '@/components/auth/ClientAuthStep'

const TIPOLOGIAS = [
  {
    id: 'ALVEOLAR',
    title: 'Alveolar',
    desc: 'Liviana, sin columnas centrales. Ideal para depósitos y galpones medianos.',
    icon: <Building2 className="mb-3 h-10 w-10" />,
    detalle: 'Perfilería liviana. Óptima hasta ~30m de luz.',
  },
  {
    id: 'ALMA_LLENA',
    title: 'Alma Llena',
    desc: 'Pesada, para naves altas y puentes grúa.',
    icon: <Factory className="mb-3 h-10 w-10" />,
    detalle: 'Sección H soldada o laminada. Requiere cálculo de cargas especiales.',
  },
  {
    id: 'RETICULADA',
    title: 'Reticulada',
    desc: 'Para campos y logística estándar.',
    icon: <Home className="mb-3 h-10 w-10" />,
    detalle: 'Estructura articulada en celosía. Económica para grandes luces.',
  },
]

const CUBIERTAS = [
  { id: 'CHAPA_TRAPEZOIDAL', title: 'Chapa Trapezoidal 25/75', desc: 'Económica, ideal para climas secos.' },
  { id: 'PANEL_SANDWICH', title: 'Panel Sandwich 50mm', desc: 'Aislación térmica/acústica superior.' },
]

const CERRAMIENTOS = [
  { id: 'CHAPA',    title: 'Chapa Metálica',      desc: 'Estándar, bajo costo.' },
  { id: 'PANEL',    title: 'Panel Sandwich',       desc: 'Con aislación térmica.' },
  { id: 'MIXTO',    title: 'Mixto (Chapa+Panel)',  desc: 'Zona inferior chapa, superior panel.' },
  { id: 'SIN_CERR', title: 'Sin cerramiento',      desc: 'Solo estructura y cubierta.' },
]

// Steps: 0=Bienvenida 1=Tipología 2=Dimensiones 3=Cubierta 4=Alcance 5=Planos 6=Contacto 7=Auth 8=Gracias
const TOTAL_STEPS = 9

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i < current ? 'bg-[#F05A28]' : i === current ? 'bg-[#F05A28]/50' : 'bg-gray-200'
          } ${i === current ? 'flex-[2]' : 'flex-1'}`}
        />
      ))}
    </div>
  )
}

function SelectionCard({
  selected, onClick, children, className = ''
}: { selected?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border-2 rounded-2xl p-5 transition-all hover:border-[#F05A28] hover:shadow-lg ${
        selected ? 'border-[#F05A28] bg-orange-50 shadow-md' : 'border-gray-100 bg-white'
      } ${className}`}
    >
      {children}
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="w-5 h-5 text-[#F05A28]" />
        </div>
      )}
    </div>
  )
}

function PriceBadge({ price, loading }: { price: number | null; loading: boolean }) {
  if (price === null && !loading) return null

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          <span className="text-sm text-slate-400 font-medium">Calculando...</span>
        </div>
      ) : price !== null && price > 0 ? (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <div>
            <p className="text-xs text-emerald-600 font-semibold leading-tight">Precio estimado</p>
            <p className="text-lg font-extrabold text-emerald-700 leading-tight">
              USD {price.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="group relative">
            <Info className="w-4 h-4 text-emerald-400 cursor-help" />
            <div className="hidden group-hover:block absolute right-0 top-6 w-60 bg-[#1B2A47] text-white text-xs rounded-xl p-3 shadow-xl z-10">
              Precio orientativo. El presupuesto definitivo será elaborado por nuestro equipo comercial.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function CotizadorWizard() {
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
    tiene_puente_grua: false,
    carga_puente_grua_tn: '',
    ubicacion_obra: '',
    // Contacto
    cliente_nombre: '',
    cliente_apellido: '',
    cliente_dni: '',
    cliente_empresa: '',
    cliente_email: '',
    cliente_telefono: '',
    observaciones: '',
  })

  const [visionLoading, setVisionLoading] = useState(false)
  const [visionSuccess, setVisionSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null)
  const [estimating, setEstimating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nextStep = () => setStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1))
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0))
  const set = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }))

  const handleSelect = (field: string, value: any) => {
    set(field, value)
    setTimeout(nextStep, 250)
  }

  // Estimar precio en tiempo real con debounce
  const requestEstimate = useCallback((data: Record<string, any>) => {
    const ancho = Number(data.ancho_m) || 0
    const largo = Number(data.largo_m) || 0
    const superficie = ancho * largo

    if (!data.tipologia || superficie <= 0) return

    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current)

    setEstimating(true)
    estimateTimerRef.current = setTimeout(async () => {
      try {
        const datosTecnicos = {
          superficie_m2: superficie,
          tipologia: data.tipologia,
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
        }
        const res = await fetch('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datosTecnicos }),
        })
        const result = await res.json()
        setEstimatedPrice(result.totalVentaUSD || 0)
      } catch {
        // Silently fail — no interrumpir la UX del wizard
      } finally {
        setEstimating(false)
      }
    }, 600)
  }, [])

  // Re-estimar cuando cambien campos relevantes
  useEffect(() => {
    if (step >= 2) {
      requestEstimate(formData)
    }
  }, [
    formData.tipologia,
    formData.ancho_m,
    formData.largo_m,
    formData.tipo_cubierta,
    formData.incluye_cerramiento_lateral,
    formData.incluye_portones,
    formData.cantidad_portones,
    formData.incluye_piso_industrial,
    formData.incluye_instalacion_electrica,
    formData.incluye_instalacion_sanitaria,
    step,
  ])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVisionLoading(true)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      try {
        const res = await fetch('/api/ingest/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: reader.result as string }),
        })
        const result = await res.json()
        if (result.data) {
          setFormData(prev => ({
            ...prev,
            ancho_m: result.data.ancho_m || prev.ancho_m,
            largo_m: result.data.largo_m || prev.largo_m,
            altura_libre_m: result.data.altura_libre_m || prev.altura_libre_m,
            tipologia: result.data.tipologia && result.data.tipologia !== 'INDEFINIDO'
              ? result.data.tipologia : prev.tipologia,
          }))
          setVisionSuccess(true)
          setTimeout(() => { setVisionSuccess(false); nextStep() }, 1500)
        } else {
          alert('No pudimos leer el plano. Por favor completá los datos manualmente.')
          nextStep()
        }
      } catch {
        alert('Error procesando plano')
      } finally {
        setVisionLoading(false)
      }
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const ancho = Number(formData.ancho_m) || 0
      const largo = Number(formData.largo_m) || 0
      const datosTecnicos = {
        ...formData,
        ancho_m: ancho,
        largo_m: largo,
        superficie_m2: ancho * largo,
        cliente: `${formData.cliente_nombre} ${formData.cliente_apellido}`.trim() || formData.cliente_empresa || 'Web',
        ubicacion: formData.ubicacion_obra,
      }

      const createRes = await fetch('/api/proyectos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: 'web_publica', variables: datosTecnicos }),
      })
      const { proyectoId, error: createError } = await createRes.json()
      if (createError) throw new Error(createError)

      await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, datosTecnicos }),
      })

      nextStep()
    } catch (err: any) {
      alert('Ocurrió un error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const showPrice = step >= 2 && (estimatedPrice !== null || estimating)

  const inputClass = "w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none transition-shadow text-[#1B2A47]"
  const labelClass = "block text-sm font-semibold text-slate-600 mb-2"
  const btnSecondary = "flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors"

  const slideProps = {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
    transition: { duration: 0.25, ease: 'easeOut' as const },
  }

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col border border-gray-100" style={{ minHeight: 580 }}>

      {/* HEADER */}
      <div className="bg-slate-50 px-8 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <img src="/logo.png" alt="Log Metal" className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            {showPrice && (
              <PriceBadge price={estimatedPrice} loading={estimating} />
            )}
            <div className="text-sm text-gray-400 font-medium">
              {step === 0 ? 'Cotizador Inteligente' : step < TOTAL_STEPS - 1 ? `Paso ${step} de ${TOTAL_STEPS - 2}` : ''}
            </div>
          </div>
        </div>
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <ProgressBar current={step - 1} total={TOTAL_STEPS - 2} />
        )}
      </div>

      <div className="flex-1 relative overflow-hidden bg-white">
        <AnimatePresence mode="wait">

          {/* STEP 0: BIENVENIDA */}
          {step === 0 && (
            <motion.div key="s0" {...slideProps} className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6 min-h-[480px]">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-2">
                <Building2 className="w-8 h-8 text-[#F05A28]" />
              </div>
              <h2 className="text-4xl font-extrabold text-[#1B2A47] leading-tight">Cotizá tu nave<br />en 2 minutos</h2>
              <p className="text-slate-500 max-w-md text-lg">
                Completá los datos de tu proyecto y nuestro equipo comercial te enviará un presupuesto personalizado.
              </p>
              <button
                onClick={nextStep}
                className="mt-4 bg-[#F05A28] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition-all shadow-xl hover:scale-105"
              >
                Comenzar Cotización <ChevronRight className="inline" />
              </button>
            </motion.div>
          )}

          {/* STEP 1: TIPOLOGÍA */}
          {step === 1 && (
            <motion.div key="s1" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-[#1B2A47] mb-2 text-center">¿Qué tipo de estructura?</h2>
              <p className="text-slate-500 text-center text-sm mb-6">Seleccioná el sistema estructural de tu nave industrial</p>
              <div className="grid md:grid-cols-3 gap-4">
                {TIPOLOGIAS.map(t => (
                  <div key={t.id} className="relative">
                    <SelectionCard selected={formData.tipologia === t.id} onClick={() => handleSelect('tipologia', t.id)}>
                      <div className={`flex justify-center ${formData.tipologia === t.id ? 'text-[#F05A28]' : 'text-[#1B2A47]'}`}>{t.icon}</div>
                      <h3 className="font-bold text-lg mb-1 text-center">{t.title}</h3>
                      <p className="text-xs text-gray-500 text-center">{t.desc}</p>
                      {formData.tipologia === t.id && (
                        <p className="text-xs text-[#F05A28] text-center mt-2 font-medium">{t.detalle}</p>
                      )}
                    </SelectionCard>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: DIMENSIONES */}
          {step === 2 && (
            <motion.div key="s2" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Ruler className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Dimensiones de la nave</h2>
                  <p className="text-slate-500 text-sm">Tipología: <strong>{formData.tipologia}</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Ancho (m) *</label>
                  <input type="number" value={formData.ancho_m} onChange={e => set('ancho_m', e.target.value)}
                    className={inputClass} placeholder="Ej: 20" min="0" />
                </div>
                <div>
                  <label className={labelClass}>Largo (m) *</label>
                  <input type="number" value={formData.largo_m} onChange={e => set('largo_m', e.target.value)}
                    className={inputClass} placeholder="Ej: 50" min="0" />
                </div>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Altura libre interior (m) *</label>
                <input type="number" value={formData.altura_libre_m} onChange={e => set('altura_libre_m', e.target.value)}
                  className={inputClass} placeholder="Ej: 8" min="0" step="0.5" />
                <p className="text-xs text-gray-400 mt-1">Altura medida desde el piso hasta la viga o cumbrera más baja.</p>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Ubicación de la obra</label>
                <input type="text" value={formData.ubicacion_obra} onChange={e => set('ubicacion_obra', e.target.value)}
                  className={inputClass} placeholder="Ciudad, Provincia" />
              </div>

              {formData.tipologia === 'ALMA_LLENA' && (
                <div className="mb-4 bg-blue-50 rounded-xl p-4">
                  <p className="font-semibold text-[#1B2A47] mb-3">¿Incluye puente grúa?</p>
                  <div className="flex gap-3">
                    {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(opt => (
                      <button key={String(opt.v)} onClick={() => set('tiene_puente_grua', opt.v)}
                        className={`flex-1 py-2 rounded-xl border-2 font-bold transition-all ${formData.tiene_puente_grua === opt.v ? 'border-[#F05A28] bg-orange-50 text-[#F05A28]' : 'border-gray-200'}`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  {formData.tiene_puente_grua && (
                    <div className="mt-3">
                      <label className={labelClass}>Capacidad del puente grúa (toneladas)</label>
                      <input type="number" value={formData.carga_puente_grua_tn} onChange={e => set('carga_puente_grua_tn', e.target.value)}
                        className={inputClass} placeholder="Ej: 10" min="1" />
                    </div>
                  )}
                </div>
              )}

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
            <motion.div key="s3" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-[#1B2A47] mb-2">Tipo de cubierta</h2>
              <p className="text-slate-500 text-sm mb-6">¿Qué material querés para el techo de la nave?</p>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {CUBIERTAS.map(c => (
                  <div key={c.id} className="relative">
                    <SelectionCard selected={formData.tipo_cubierta === c.id} onClick={() => set('tipo_cubierta', c.id)}>
                      <h3 className="font-bold text-base mb-1">{c.title}</h3>
                      <p className="text-xs text-gray-500">{c.desc}</p>
                    </SelectionCard>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700">
                  Continuar <ChevronRight className="inline" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: ALCANCE */}
          {step === 4 && (
            <motion.div key="s4" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <ToggleLeft className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Alcance del proyecto</h2>
                  <p className="text-slate-500 text-sm">¿Qué ítems incluye tu presupuesto?</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { field: 'incluye_cerramiento_lateral', label: 'Cerramiento lateral', desc: 'Chapa o panel en las paredes laterales' },
                  { field: 'incluye_portones', label: 'Portones metálicos', desc: 'Portones corredizos o abatibles' },
                  { field: 'incluye_piso_industrial', label: 'Piso industrial', desc: 'Hormigón H-25 con cuarzo' },
                  { field: 'incluye_instalacion_electrica', label: 'Instalación eléctrica', desc: 'Tablero, bocas, iluminación LED' },
                  { field: 'incluye_instalacion_sanitaria', label: 'Instalación sanitaria', desc: 'Vestuarios, baños, cocina' },
                ].map(item => (
                  <div key={item.field}
                    onClick={() => set(item.field, !formData[item.field])}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${formData[item.field] ? 'border-[#F05A28] bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}>
                    <div>
                      <p className="font-semibold text-[#1B2A47]">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${formData[item.field] ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
                      <div className="w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  </div>
                ))}
              </div>

              {formData.incluye_portones && (
                <div className="mb-4">
                  <label className={labelClass}>Cantidad de portones</label>
                  <input type="number" value={formData.cantidad_portones} onChange={e => set('cantidad_portones', e.target.value)}
                    className={inputClass} min="1" max="20" placeholder="Ej: 2" />
                </div>
              )}

              {formData.incluye_cerramiento_lateral && (
                <div className="mb-4">
                  <p className="font-semibold text-[#1B2A47] mb-3 text-sm">Tipo de cerramiento lateral:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CERRAMIENTOS.map(c => (
                      <div key={c.id} className="relative">
                        <SelectionCard selected={formData.tipo_cerramiento === c.id} onClick={() => set('tipo_cerramiento', c.id)} className="!p-3">
                          <p className="font-semibold text-sm">{c.title}</p>
                          <p className="text-xs text-gray-400">{c.desc}</p>
                        </SelectionCard>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} className="flex-1 bg-[#1B2A47] text-white py-3 rounded-xl font-bold hover:bg-slate-700">
                  Continuar <ChevronRight className="inline" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: IA VISION (Planos opcionales) */}
          {step === 5 && (
            <motion.div key="s5" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center max-w-xl mx-auto w-full text-center">
              <h2 className="text-2xl font-bold text-[#1B2A47] mb-2">¿Tenés un plano o boceto?</h2>
              <p className="text-slate-500 text-sm mb-6">Subilo y nuestra IA extrae más detalles para refinar el presupuesto. <strong>Es opcional.</strong></p>

              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#F05A28] bg-orange-50/50 rounded-2xl p-10 cursor-pointer hover:bg-orange-50 transition-colors flex flex-col items-center justify-center mb-4">
                {visionLoading ? (
                  <><Loader2 className="h-10 w-10 text-[#F05A28] animate-spin mb-3" /><span className="font-semibold text-[#F05A28]">Analizando plano con IA...</span></>
                ) : visionSuccess ? (
                  <><CheckCircle2 className="h-12 w-12 text-green-500 mb-3" /><span className="font-bold text-xl text-green-600">¡Medidas actualizadas!</span></>
                ) : (
                  <><UploadCloud className="h-10 w-10 text-[#F05A28] mb-3" /><span className="font-bold text-[#1B2A47]">Subir Imagen o Plano</span><span className="text-xs text-gray-400 mt-1">JPG, PNG — incluye fotos de dibujos a mano</span></>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              </div>

              <div className="flex gap-3">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button onClick={nextStep} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300">
                  Omitir y continuar
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 6: CONTACTO + CONFIRMAR */}
          {step === 6 && (
            <motion.div key="s6" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Tus datos de contacto</h2>
                  <p className="text-slate-500 text-sm">Para que nuestro equipo te envíe el presupuesto</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input type="text" value={formData.cliente_nombre} onChange={e => set('cliente_nombre', e.target.value)}
                    className={inputClass} placeholder="Juan" />
                </div>
                <div>
                  <label className={labelClass}>Apellido *</label>
                  <input type="text" value={formData.cliente_apellido} onChange={e => set('cliente_apellido', e.target.value)}
                    className={inputClass} placeholder="García" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>DNI *</label>
                  <input type="text" value={formData.cliente_dni} onChange={e => set('cliente_dni', e.target.value)}
                    className={inputClass} placeholder="30.123.456" />
                </div>
                <div>
                  <label className={labelClass}>Empresa / SRL</label>
                  <input type="text" value={formData.cliente_empresa} onChange={e => set('cliente_empresa', e.target.value)}
                    className={inputClass} placeholder="Mi Empresa SRL" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" value={formData.cliente_email} onChange={e => set('cliente_email', e.target.value)}
                    className={inputClass} placeholder="tu@empresa.com" />
                </div>
                <div>
                  <label className={labelClass}>Teléfono / WhatsApp</label>
                  <input type="tel" value={formData.cliente_telefono} onChange={e => set('cliente_telefono', e.target.value)}
                    className={inputClass} placeholder="+54 9 261 xxx-xxxx" />
                </div>
              </div>

              <div className="mb-5">
                <label className={labelClass}>Observaciones adicionales</label>
                <textarea value={formData.observaciones} onChange={e => set('observaciones', e.target.value)}
                  className={`${inputClass} resize-none`} rows={2}
                  placeholder="Ej: necesito entrepiso, zona sísmica, plazo urgente, etc." />
              </div>

              {/* Resumen del proyecto */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm text-slate-600">
                <p className="font-bold text-[#1B2A47] mb-2">Resumen del proyecto</p>
                <div className="grid grid-cols-2 gap-1">
                  <span>Tipología:</span><span className="font-semibold">{formData.tipologia}</span>
                  <span>Dimensiones:</span><span className="font-semibold">{formData.ancho_m}m × {formData.largo_m}m × {formData.altura_libre_m}m alt.</span>
                  <span>Superficie:</span><span className="font-semibold">{(Number(formData.ancho_m) * Number(formData.largo_m)).toFixed(0)} m²</span>
                  <span>Cubierta:</span><span className="font-semibold">{formData.tipo_cubierta?.replace(/_/g, ' ')}</span>
                  {estimatedPrice !== null && estimatedPrice > 0 && (
                    <><span>Precio estimado:</span><span className="font-bold text-emerald-600">USD {estimatedPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={prevStep} className={btnSecondary}>Atrás</button>
                <button
                  onClick={nextStep}
                  disabled={!formData.cliente_nombre || !formData.cliente_apellido || !formData.cliente_dni || !formData.cliente_email}
                  className="flex-1 bg-[#F05A28] text-white py-4 rounded-xl font-bold text-base hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-orange-200"
                >
                  <CalendarCheck className="w-5 h-5" /> Continuar
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: AUTH */}
          {step === 7 && (
            <motion.div key="s7" {...slideProps} className="p-8 min-h-[480px] flex flex-col justify-center max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#1B2A47]">Creá tu cuenta</h2>
                  <p className="text-slate-500 text-sm">Para hacer el seguimiento de tu proyecto</p>
                </div>
              </div>

              <ClientAuthStep
                email={formData.cliente_email}
                nombre={`${formData.cliente_nombre} ${formData.cliente_apellido}`.trim()}
                submitting={submitting}
                onSuccess={handleSubmit}
              />

              <button onClick={prevStep} className={`${btnSecondary} mt-5`}>Atrás</button>
            </motion.div>
          )}

          {/* STEP 8: GRACIAS */}
          {step === 8 && (
            <motion.div key="s7" {...slideProps} className="p-10 min-h-[480px] flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-[#1B2A47] mb-3">¡Consulta registrada!</h2>
              <p className="text-slate-600 text-lg mb-2">
                Recibimos tu solicitud correctamente.
              </p>
              <p className="text-slate-500 mb-8 max-w-sm">
                Nuestro equipo comercial revisará tu proyecto y se pondrá en contacto
                a la brevedad para enviarte el presupuesto detallado y acordar una reunión.
              </p>

              {estimatedPrice !== null && estimatedPrice > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 mb-6 max-w-xs">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">Precio estimado</p>
                  <p className="text-3xl font-extrabold text-emerald-700">
                    USD {estimatedPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Valor orientativo. El presupuesto definitivo puede variar según relevamiento técnico.
                  </p>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 mb-8 max-w-xs text-sm text-[#1B2A47]">
                <p className="font-bold mb-1">¿Querés hablar con un asesor ahora?</p>
                <a href="https://wa.me/5492616666666" target="_blank" rel="noreferrer"
                  className="text-[#F05A28] font-semibold hover:underline">
                  Contactanos por WhatsApp →
                </a>
              </div>

              <button onClick={() => window.location.href = '/'}
                className="bg-[#1B2A47] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-slate-700 transition-all">
                Volver al inicio
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
