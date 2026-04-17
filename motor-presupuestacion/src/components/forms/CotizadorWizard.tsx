'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Factory, Home, CheckCircle2, ChevronRight, UploadCloud, FileType, Check, Loader2 } from 'lucide-react'

const TIPOLOGIAS = [
  { id: 'ALVEOLAR', title: 'Alveolar', desc: 'Liviana, sin columnas centrales.', icon: <Building2 className="mb-4 h-12 w-12" /> },
  { id: 'ALMA_LLENA', title: 'Alma Llena', desc: 'Pesada, naves altas y puentes grúa.', icon: <Factory className="mb-4 h-12 w-12" /> },
  { id: 'RETICULADO', title: 'Reticulada', desc: 'Para campos y logística estándar.', icon: <Home className="mb-4 h-12 w-12" /> },
]

export default function CotizadorWizard() {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>({
    tipologia: '',
    ancho_m: '',
    largo_m: '',
    altura_libre_m: '',
    cliente_email: '',
    incluye_cubierta: true,
    incluye_montaje: true,
  })
  
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionSuccess, setVisionSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const nextStep = () => setStep(prev => prev + 1)
  const handleSelect = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Retrasar muy poco el paso siguiente si es una selección rápida para mejorar la UX
    setTimeout(nextStep, 300)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setVisionLoading(true)
    
    // Convert to base64
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      const dataUrl = reader.result as string
      
      try {
        const res = await fetch('/api/ingest/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl })
        })
        const result = await res.json()
        if (result.data) {
           setFormData(prev => ({
             ...prev,
             ancho_m: result.data.ancho_m || prev.ancho_m,
             largo_m: result.data.largo_m || prev.largo_m,
             altura_libre_m: result.data.altura_libre_m || prev.altura_libre_m,
           }))
           setVisionSuccess(true)
           setTimeout(() => { setVisionSuccess(false); nextStep(); }, 1500)
        } else {
           alert("No pudimos leer el plano.")
        }
      } catch (err) {
        alert("Error procesando plano")
      } finally {
        setVisionLoading(false)
      }
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col h-[600px] border border-gray-100">
      
      {/* HEADER / PROGRESS */}
      <div className="bg-slate-50 p-6 flex items-center justify-between border-b border-gray-100">
         <div className="text-xl font-bold text-[#1B2A47]">LOG<span className="text-[#F05A28]">METAL</span></div>
         <div className="text-sm font-semibold text-gray-400">Paso {step + 1} de 5</div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-white p-8">
        <AnimatePresence mode="wait">
          
          {/* STEP 0: BIENVENIDA */}
          {step === 0 && (
            <motion.div 
              key="step0"
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-6"
            >
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#1B2A47]">Démosle forma a tu proyecto</h2>
              <p className="text-lg text-slate-500 max-w-xl">
                Nuestro Asistente de Inteligencia Artificial te guiará para obtener un presupuesto Base 0 en menos de 2 minutos.
              </p>
              <button 
                onClick={nextStep}
                className="mt-8 bg-[#F05A28] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-orange-600 transition-all shadow-xl hover:scale-105"
              >
                Comenzar Cotización
              </button>
            </motion.div>
          )}

          {/* STEP 1: Selección de Tipología */}
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col justify-center"
            >
              <h2 className="text-3xl font-bold text-[#1B2A47] mb-8 text-center">¿Qué tipo de estructura imaginas?</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {TIPOLOGIAS.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => handleSelect('tipologia', t.id)}
                    className={`cursor-pointer border-2 rounded-2xl p-6 text-center transition-all hover:border-[#F05A28] hover:shadow-lg ${formData.tipologia === t.id ? 'border-[#F05A28] bg-orange-50' : 'border-gray-100'}`}
                  >
                    <div className={`flex justify-center ${formData.tipologia === t.id ? 'text-[#F05A28]' : 'text-[#1B2A47]'}`}>{t.icon}</div>
                    <h3 className="font-bold text-lg mb-2">{t.title}</h3>
                    <p className="text-sm text-gray-500">{t.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Inteligencia Artificial o Datos Manuales */}
          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col justify-center max-w-2xl mx-auto text-center"
            >
              <h2 className="text-3xl font-bold text-[#1B2A47] mb-4">¿Tienes un boceto o plano?</h2>
              <p className="text-slate-500 mb-8">Nuestra IA puede "mirarlo" y extraer las dimensiones por vos automáticamente.</p>
              
              <div className="space-y-6">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#F05A28] bg-orange-50/50 rounded-2xl p-10 cursor-pointer hover:bg-orange-50 transition-colors flex flex-col items-center justify-center relative"
                >
                  {visionLoading ? (
                    <div className="flex flex-col items-center text-[#F05A28]">
                       <Loader2 className="h-10 w-10 animate-spin mb-4" />
                       <span className="font-semibold">Nuestra IA está analizando el plano...</span>
                    </div>
                  ) : visionSuccess ? (
                    <div className="flex flex-col items-center text-green-600">
                       <CheckCircle2 className="h-12 w-12 mb-4" />
                       <span className="font-bold text-xl">¡Medidas extraídas con éxito!</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="h-12 w-12 text-[#F05A28] mb-4" />
                      <span className="font-bold text-[#1B2A47] text-lg">Subir Imagen o Plano</span>
                      <span className="text-sm text-gray-500 mt-2">Permitido: JPG, PNG. Reconocemos fotos de dibujos a mano.</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                </div>
                
                <div className="flex items-center gap-4 py-2">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-sm text-gray-400 font-semibold uppercase">O ingresalas manualmente</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <button 
                  onClick={nextStep}
                  className="w-full bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Ingresar medidas a mano
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Ajuste Manual de Medidas */}
          {step === 3 && (
            <motion.div 
               key="step3"
               initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
               className="h-full flex flex-col justify-center max-w-2xl mx-auto"
            >
               <h2 className="text-3xl font-bold text-[#1B2A47] mb-8 text-center">Confirmá las Dimensiones</h2>
               <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Ancho (metros)</label>
                    <input 
                      type="number" 
                      value={formData.ancho_m}
                      onChange={e => setFormData({...formData, ancho_m: e.target.value})}
                      className="w-full text-2xl p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none transition-shadow" 
                      placeholder="Ej: 20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Largo (metros)</label>
                    <input 
                      type="number" 
                      value={formData.largo_m}
                      onChange={e => setFormData({...formData, largo_m: e.target.value})}
                      className="w-full text-2xl p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none transition-shadow" 
                      placeholder="Ej: 50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Altura Libre (metros)</label>
                    <input 
                      type="number" 
                      value={formData.altura_libre_m}
                      onChange={e => setFormData({...formData, altura_libre_m: e.target.value})}
                      className="w-full text-2xl p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none transition-shadow" 
                      placeholder="Ej: 8"
                    />
                  </div>
               </div>
               <button 
                  onClick={nextStep}
                  disabled={!formData.ancho_m || !formData.largo_m}
                  className="w-full bg-[#1B2A47] text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Continuar
                </button>
            </motion.div>
          )}

          {/* STEP 4: Submit / Capture */}
          {step === 4 && (
            <motion.div 
               key="step4"
               initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
               className="h-full flex flex-col justify-center items-center text-center max-w-lg mx-auto"
            >
               <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                 <Check className="w-10 h-10 text-green-600" />
               </div>
               <h2 className="text-3xl font-bold text-[#1B2A47] mb-4">¡Todo listo para presupuestar!</h2>
               <p className="text-slate-500 mb-8">
                 Ingresa tu correo para ejecutar el motor de cálculo y recibir el presupuesto Base 0 en PDF al instante.
               </p>
               <input 
                  type="email" 
                  value={formData.cliente_email}
                  onChange={e => setFormData({...formData, cliente_email: e.target.value})}
                  className="w-full text-lg p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none mb-4 text-center" 
                  placeholder="tu@empresa.com"
                />
                <button 
                  onClick={async () => {
                     setVisionLoading(true) // Reusing loading state visually
                     try {
                        // Build enriched datos from wizard form
                        const ancho = Number(formData.ancho_m) || 0
                        const largo = Number(formData.largo_m) || 0
                        const superficie = ancho * largo
                        const datosTecnicos = {
                           ...formData,
                           ancho_m: ancho,
                           largo_m: largo,
                           superficie_m2: superficie,
                           incluye_fabricacion: true,
                           incluye_montaje: true,
                           incluye_cubierta: true,
                           incluye_cerramiento_lateral: false,
                           incluye_portones: false,
                           incluye_piso_industrial: false,
                           incluye_instalacion_electrica: false,
                           incluye_instalacion_sanitaria: false,
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


                        // Descargar PDF como blob
                        const exportRes = await fetch(`/api/export?proyectoId=${proyectoId}`, {
                           method: 'GET'
                        })
                        
                        if (!exportRes.ok) throw new Error("Error generando PDF")

                        const blob = await exportRes.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `Presupuesto_LogMetal.pdf`
                        a.click()
                        
                        alert('¡El PDF ha sido descargado!')
                        window.location.href = '/' // Return to home
                     } catch(err: any) {
                        alert('Ocurrió un error: ' + err.message)
                     } finally {
                        setVisionLoading(false)
                     }
                  }}
                  disabled={!formData.cliente_email || visionLoading}
                  className="w-full bg-[#F05A28] text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {visionLoading ? <Loader2 className="animate-spin" /> : 'Mágia! Calcular y Enviar PDF'}
                </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  )
}
