'use client'

import { useState } from 'react'
import R09Form from './R09Form'
import Base0Table from '../presupuesto/Base0Table'

type Canal = 'whatsapp_audio' | 'whatsapp_texto' | 'manual' | 'documento'

const PASOS = [
  { id: 1, titulo: 'Canal de entrada', icono: '📡' },
  { id: 2, titulo: 'Carga de datos', icono: '📥' },
  { id: 3, titulo: 'Variables R-09', icono: '📋' },
  { id: 4, titulo: 'Presupuesto Base 0', icono: '🏗️' },
  { id: 5, titulo: 'R-04 Comercial', icono: '📄' },
  { id: 6, titulo: 'Validar y enviar', icono: '✅' },
]

const CANALES = [
  { id: 'whatsapp_audio', label: 'Audio de WhatsApp', desc: 'Sube un .ogg o nota de voz' },
  { id: 'whatsapp_texto', label: 'Texto de WhatsApp', desc: 'Pega el texto del requerimiento' },
  { id: 'documento', label: 'Documento PDF/DOCX', desc: 'Sube un PDF o DOCX' },
  { id: 'manual', label: 'Carga Manual', desc: 'Llena los campos a mano' },
] as const

export default function ProyectoForm() {
  const [paso, setPaso] = useState(1)
  const [canal, setCanal] = useState<Canal | null>(null)
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [items, setItems] = useState<any[]>([])
  const [proyectoId, setProyectoId] = useState<string | null>(null)

  const stepClass = (pid: number) =>
    paso >= pid
      ? 'bg-[#F05A28] text-white shadow-md'
      : 'bg-gray-100 text-gray-400'

  const lineClass = (pid: number) =>
    paso > pid ? 'bg-[#F05A28]' : 'bg-gray-200'

  const labelClass = (pid: number) =>
    paso >= pid ? 'text-gray-800' : 'text-gray-400'

  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [textoManual, setTextoManual] = useState('')

  const handleProcess = async () => {
    setLoading(true)
    try {
      if (canal === 'whatsapp_audio' || canal === 'documento') {
        const formData = new FormData()
        if (file) formData.append('audio', file)
        
        const res = await fetch('/api/ingest/whatsapp', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (!data.variables) throw new Error('No se pudieron extraer variables.')
        setVariables(data.variables)
      } else {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: textoManual }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (!data.variables) throw new Error('No se pudieron extraer variables.')
        setVariables(data.variables)
      }
      setPaso(3)
    } catch (error: any) {
      console.error('Error procesando:', error)
      alert('Error al procesar: ' + (error.message || 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-xl rounded-xl border border-gray-100">
      {/* Stepper */}
      <div className="flex items-center mb-10 gap-2 overflow-x-auto pb-4">
        {PASOS.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 shrink-0">
            <div className={['w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300', stepClass(p.id)].join(' ')}>
              {paso > p.id ? '✓' : p.id}
            </div>
            <span className={['text-sm font-medium', labelClass(p.id)].join(' ')}>
              {p.titulo}
            </span>
            {i < PASOS.length - 1 && (
              <div className={['w-8 h-px mx-1', lineClass(p.id)].join(' ')} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">

        {/* Paso 1: Canal */}
        {paso === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-[#1B2A47]">Seleccione el canal de entrada</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CANALES.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setCanal(opt.id as Canal); setPaso(2) }}
                  className="p-6 border-2 border-gray-200 rounded-lg text-left hover:border-[#F05A28] hover:bg-orange-50 transition-colors group"
                >
                  <h3 className="font-bold text-lg text-gray-800 group-hover:text-[#F05A28]">{opt.label}</h3>
                  <p className="text-gray-500 text-sm mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Paso 2: Ingesta */}
        {paso === 2 && canal && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-[#1B2A47]">Carga de datos crudos</h2>
              <button 
                onClick={() => { setPaso(1); setFile(null); setTextoManual('') }} 
                className="text-sm text-gray-500 hover:text-gray-800 underline"
              >
                Volver
              </button>
            </div>
            
            <div className="bg-gray-50 p-8 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center min-h-[300px]">
              {canal === 'whatsapp_texto' || canal === 'manual' ? (
                <div className="w-full space-y-4">
                  <p className="text-sm font-medium text-gray-700">Pega el texto aquí:</p>
                  <textarea 
                    className="w-full h-40 p-4 border rounded-md shadow-sm focus:ring-[#F05A28] focus:border-[#F05A28]"
                    placeholder="Ej: Hola, necesito un galpón de 20x40..."
                    value={textoManual}
                    onChange={(e) => setTextoManual(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl">📁</span>
                  </div>
                  <p className="text-lg font-medium text-gray-800">Sube tu archivo</p>
                  <p className="text-sm text-gray-500 mb-6">{canal === 'whatsapp_audio' ? '.ogg, .mp3, .wav' : '.pdf, .docx'}</p>
                  
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept={canal === 'whatsapp_audio' ? "audio/*" : ".pdf,.doc,.docx"}
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer bg-white border-2 border-[#1B2A47] text-[#1B2A47] px-6 py-2 rounded font-semibold hover:bg-gray-50 mb-2"
                  >
                    {file ? file.name : 'Seleccionar Archivo'}
                  </label>
                  {file && <span className="text-xs text-green-600 font-bold">✓ Archivo cargado</span>}
                </div>
              )}
              
              <button 
                onClick={handleProcess}
                disabled={loading || (!file && !textoManual)}
                className={['mt-10 bg-[#1B2A47] text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100', loading ? 'animate-pulse' : ''].join(' ')}
              >
                {loading ? 'Procesando con IA...' : 'Procesar con IA →'}
              </button>
            </div>
          </div>
        )}

        {/* Paso 3: R-09 */}
        {paso === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-[#1B2A47]">Revisión de Variables R-09</h2>
            <p className="text-gray-600">Verifique los datos extraídos por la IA antes de calcular.</p>
            <R09Form variables={variables} onChange={setVariables} />
            <div className="flex justify-end">
              <button 
                onClick={async () => {
                  setLoading(true)
                  try {
                    // 1. Guardar Proyecto Real
                    const createRes = await fetch('/api/proyectos/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ canal, variables }),
                    })
                    const { proyectoId: newId, error } = await createRes.json()
                    if (error) throw new Error(error)
                    setProyectoId(newId)

                    // 2. Calcular Base 0 (Pure logic)
                    const res = await fetch('/api/calculate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ proyectoId: newId, datosTecnicos: variables }),
                    })
                    const data = await res.json()
                    setItems(data.items)
                    setPaso(4)
                  } catch (e: any) {
                    alert('Error en persistencia o cálculo: ' + e.message)
                  } finally {
                    setLoading(false)
                  }
                }} 
                className="bg-[#1B2A47] text-white px-6 py-2 rounded font-semibold hover:bg-[#1B2A47]/90"
              >
                {loading ? 'Procesando...' : 'Confirmar y Calcular Presupuesto →'}
              </button>
            </div>
          </div>
        )}
        
        {/* Paso 4: Base 0 */}
        {paso === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-[#1B2A47]">Presupuesto Base 0</h2>
            <p className="text-gray-600">Detalle de costos y márgenes por rubro. Edite los márgenes antes de avanzar.</p>
            <Base0Table items={items} onChange={setItems} onNext={() => setPaso(5)} />
          </div>
        )}

        {/* Paso 5: R-04 */}
        {paso === 5 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-[#1B2A47]">Vista Previa R-04 Comercial</h2>
            <p className="text-gray-600">Este es el documento que se enviará al cliente. Revise los montos finales.</p>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 min-h-[500px] flex flex-col shadow-inner">
               <iframe 
                src={`/api/export?proyectoId=${proyectoId}&preview=true`} 
                className="w-full h-[600px] border-none"
                title="Vista Previa PDF"
               />
            </div>

            <div className="flex justify-between items-center bg-orange-50 p-4 rounded-lg border border-orange-100">
               <div>
                 <p className="text-sm text-orange-800 font-medium">¿Todo listo para enviar?</p>
                 <p className="text-xs text-orange-600">Al aprobar, se registrará en el sistema y se preparará para Flexxus.</p>
               </div>
               <button 
                onClick={async () => {
                   setLoading(true)
                   try {
                     // Lógica manual de guardado final aquí si fuera necesario
                     await new Promise(r => setTimeout(r, 1000)) // Simulación
                     setPaso(6)
                   } finally {
                     setLoading(false)
                   }
                }} 
                className="bg-[#F05A28] text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-[#F05A28]/90"
               >
                 {loading ? 'Guardando...' : 'Aprobar y Finalizar ✓'}
               </button>
            </div>
          </div>
        )}

        {/* Paso 6: Done */}
        {paso === 6 && (
          <div className="space-y-4 text-center py-10">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto text-3xl">✓</div>
            <h2 className="text-2xl font-semibold text-[#1B2A47]">¡Completado!</h2>
            <p className="text-gray-600">El presupuesto R-04 fue guardado y está listo para enviar.</p>
            <a href="/proyectos" className="mt-6 bg-[#1B2A47] text-white px-6 py-2 rounded font-semibold hover:bg-[#1B2A47]/90 inline-block">
              Ir a Proyectos
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
