'use client'

import React, { useRef, useState } from 'react'
import {
  Building2, CheckCircle2, Loader2, Paperclip, UploadCloud, X, FileText, Trash2,
  ChevronDown, ChevronRight,
} from 'lucide-react'

type Doc = { nombre: string; tipoMime: string; tamanoBytes: number; contenidoBase64: string }

const MAX_DOCS = 8
const MAX_BYTES_POR_DOC = 8 * 1024 * 1024

const TIPOLOGIAS = [
  { id: '', label: 'No estoy seguro / que asesoren' },
  { id: 'ALVEOLAR', label: 'Alveolar (liviana, sin columnas centrales)' },
  { id: 'ALMA_LLENA', label: 'Alma llena (naves altas / puente grúa)' },
  { id: 'RETICULADA', label: 'Reticulada (grandes luces, económica)' },
]

const CUBIERTAS = [
  { id: '', label: 'No estoy seguro / que asesoren' },
  { id: 'CHAPA_TRAPEZOIDAL', label: 'Chapa trapezoidal 25/75 (económica)' },
  { id: 'PANEL_SANDWICH', label: 'Panel sandwich 50mm (aislación térmica/acústica)' },
]

// Fila de toggle compacta (mismo look que el cotizador)
function ToggleRow({ active, onToggle, title, desc }: { active: boolean; onToggle: () => void; title: string; desc?: string }) {
  return (
    <div onClick={onToggle}
      className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${active ? 'border-[#F05A28] bg-orange-50' : 'border-gray-100 hover:border-gray-300'}`}>
      <div className="pr-4">
        <p className="font-semibold text-[#1B2A47] text-sm">{title}</p>
        {desc && <p className="text-xs text-gray-500">{desc}</p>}
      </div>
      <div className={`w-11 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${active ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
        <div className="w-4 h-4 bg-white rounded-full shadow" />
      </div>
    </div>
  )
}

function formatoBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Lee un File como base64 puro (sin el prefijo data:...;base64,)
function leerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result || '')
      const coma = res.indexOf(',')
      resolve(coma >= 0 ? res.slice(coma + 1) : res)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function SolicitudForm() {
  const [form, setForm] = useState<Record<string, any>>({
    cliente_nombre: '',
    cliente_apellido: '',
    cliente_empresa: '',
    cliente_email: '',
    cliente_telefono: '',
    ubicacion: '',
    tipologia: '',
    ancho_m: '',
    largo_m: '',
    altura_libre_m: '',
    descripcion: '',
    // Detalles opcionales (mismo alcance que el cotizador)
    tipo_cubierta: '',
    incluye_gestion_proyecto: false,
    incluye_montaje: true,
    incluye_oficina: false,
    oficina_ancho_m: '',
    oficina_largo_m: '',
    oficina_planta_alta: false,
    incluye_bano: false,
    cantidad_banos: 1,
    incluye_instalacion_electrica: false,
    incluye_portones: false,
    cantidad_portones: 1,
    incluye_movimiento_suelo: false,
  })
  const [docs, setDocs] = useState<Doc[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [mostrarDetalles, setMostrarDetalles] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))
  const toggle = (k: string) => setForm((prev) => ({ ...prev, [k]: !prev[k] }))

  const inputClass = 'w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F05A28] outline-none transition-shadow text-[#1B2A47]'
  const labelClass = 'block text-sm font-semibold text-slate-600 mb-1.5'

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    const nuevos: Doc[] = []
    for (const file of Array.from(files)) {
      if (docs.length + nuevos.length >= MAX_DOCS) {
        setError(`Podés adjuntar hasta ${MAX_DOCS} archivos.`)
        break
      }
      if (file.size > MAX_BYTES_POR_DOC) {
        setError(`"${file.name}" supera los ${MAX_BYTES_POR_DOC / 1024 / 1024} MB.`)
        continue
      }
      const contenidoBase64 = await leerBase64(file)
      nuevos.push({ nombre: file.name, tipoMime: file.type || 'application/octet-stream', tamanoBytes: file.size, contenidoBase64 })
    }
    if (nuevos.length) setDocs((prev) => [...prev, ...nuevos])
    if (fileRef.current) fileRef.current.value = ''
  }

  const quitarDoc = (i: number) => setDocs((prev) => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    setError(null)
    if (!form.cliente_nombre.trim()) { setError('Ingresá tu nombre.'); return }
    if (!form.cliente_email.includes('@')) { setError('Ingresá un email válido.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, documentos: docs }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'No se pudo enviar el formulario.'); return }
      setDone(data.codigo || null)
    } catch {
      setError('No se pudo enviar. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-lg mx-auto rounded-3xl bg-white shadow-2xl border border-gray-100 p-10 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-[#1B2A47] mb-2">¡Requerimientos enviados!</h2>
        <p className="text-slate-500 mb-4">
          Recibimos tu consulta{done ? <> (código <strong className="text-[#1B2A47]">{done}</strong>)</> : null}. Nuestro
          equipo comercial la revisará y te enviará el presupuesto formal a la brevedad.
        </p>
        <p className="text-sm text-slate-400">Ya podés cerrar esta ventana.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-[#1B2A47] px-8 py-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#F05A28] rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Contanos tu proyecto</h1>
            <p className="text-slate-300 text-sm">Completá los datos básicos y adjuntá la documentación que tengas.</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Datos de contacto */}
        <div>
          <h3 className="font-semibold text-[#1B2A47] mb-3 text-sm uppercase tracking-wide">Tus datos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre *</label>
              <input className={inputClass} value={form.cliente_nombre} onChange={(e) => set('cliente_nombre', e.target.value)} placeholder="Juan" />
            </div>
            <div>
              <label className={labelClass}>Apellido</label>
              <input className={inputClass} value={form.cliente_apellido} onChange={(e) => set('cliente_apellido', e.target.value)} placeholder="García" />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input className={inputClass} type="email" value={form.cliente_email} onChange={(e) => set('cliente_email', e.target.value)} placeholder="tu@empresa.com" />
            </div>
            <div>
              <label className={labelClass}>Teléfono / WhatsApp</label>
              <input className={inputClass} type="tel" value={form.cliente_telefono} onChange={(e) => set('cliente_telefono', e.target.value)} placeholder="+54 9 261 xxx-xxxx" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Empresa / Razón social</label>
              <input className={inputClass} value={form.cliente_empresa} onChange={(e) => set('cliente_empresa', e.target.value)} placeholder="Mi Empresa SRL" />
            </div>
          </div>
        </div>

        {/* Datos del proyecto */}
        <div>
          <h3 className="font-semibold text-[#1B2A47] mb-3 text-sm uppercase tracking-wide">Tu proyecto</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Ubicación de la obra</label>
              <input className={inputClass} value={form.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Ciudad, provincia (o dirección exacta si la tenés)" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Tipo de estructura</label>
              <select className={inputClass} value={form.tipologia} onChange={(e) => set('tipologia', e.target.value)}>
                {TIPOLOGIAS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ancho (m)</label>
              <input className={inputClass} type="number" min="0" value={form.ancho_m} onChange={(e) => set('ancho_m', e.target.value)} placeholder="Ej: 20" />
            </div>
            <div>
              <label className={labelClass}>Largo (m)</label>
              <input className={inputClass} type="number" min="0" value={form.largo_m} onChange={(e) => set('largo_m', e.target.value)} placeholder="Ej: 50" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Altura libre (m)</label>
              <input className={inputClass} type="number" min="0" step="0.5" value={form.altura_libre_m} onChange={(e) => set('altura_libre_m', e.target.value)} placeholder="Ej: 8" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Contanos qué necesitás</label>
              <textarea className={`${inputClass} resize-none`} rows={3} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)}
                placeholder="Uso de la nave, plazos, si tenés terreno, entrepiso, puente grúa, etc." />
            </div>
          </div>
        </div>

        {/* Detalles opcionales — se puede omitir */}
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <button onClick={() => setMostrarDetalles((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
            <div>
              <p className="font-semibold text-[#1B2A47] text-sm">Detalles del proyecto <span className="text-slate-400 font-normal">(opcional)</span></p>
              <p className="text-xs text-slate-500">Cubierta, gestión de obra y alcance. Podés omitirlo y lo definimos juntos.</p>
            </div>
            {mostrarDetalles ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
          </button>

          {mostrarDetalles && (
            <div className="p-4 space-y-4 border-t border-gray-100">
              {/* Tipo de cubierta */}
              <div>
                <label className={labelClass}>Tipo de cubierta</label>
                <select className={inputClass} value={form.tipo_cubierta} onChange={(e) => set('tipo_cubierta', e.target.value)}>
                  {CUBIERTAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* Gestión del proyecto */}
              <ToggleRow active={form.incluye_gestion_proyecto} onToggle={() => toggle('incluye_gestion_proyecto')}
                title="Gestión y dirección del proyecto" desc="Que LOG METAL gestione y dirija la obra (honorarios y dirección técnica)." />

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Alcance</p>
                <div className="space-y-3">
                  <ToggleRow active={form.incluye_montaje} onToggle={() => toggle('incluye_montaje')}
                    title="Montaje en obra" desc="Que nuestro equipo arme la estructura en tu terreno." />

                  {/* Oficina interior */}
                  <div className={`rounded-xl border-2 transition-all ${form.incluye_oficina ? 'border-[#F05A28]' : 'border-gray-100'}`}>
                    <div onClick={() => toggle('incluye_oficina')}
                      className={`flex items-center justify-between p-3.5 cursor-pointer ${form.incluye_oficina ? 'bg-orange-50 rounded-t-xl' : 'rounded-xl hover:border-gray-300'}`}>
                      <div className="pr-4">
                        <p className="font-semibold text-[#1B2A47] text-sm">Oficina interior</p>
                        <p className="text-xs text-gray-500">Tabiques, cielorraso, revestimientos y obra civil.</p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${form.incluye_oficina ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow" />
                      </div>
                    </div>
                    {form.incluye_oficina && (
                      <div className="p-3.5 pt-2 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Ancho oficina (m)</label>
                            <input type="number" min="0" className={inputClass} value={form.oficina_ancho_m} onChange={(e) => set('oficina_ancho_m', e.target.value)} placeholder="Ej: 5" />
                          </div>
                          <div>
                            <label className={labelClass}>Largo oficina (m)</label>
                            <input type="number" min="0" className={inputClass} value={form.oficina_largo_m} onChange={(e) => set('oficina_largo_m', e.target.value)} placeholder="Ej: 8" />
                          </div>
                        </div>
                        <ToggleRow active={form.oficina_planta_alta} onToggle={() => toggle('oficina_planta_alta')}
                          title="Con planta alta (entrepiso)" desc="Suma escalera y duplica la superficie de oficina." />
                      </div>
                    )}
                  </div>

                  {/* Baño */}
                  <div className={`rounded-xl border-2 transition-all ${form.incluye_bano ? 'border-[#F05A28]' : 'border-gray-100'}`}>
                    <div onClick={() => toggle('incluye_bano')}
                      className={`flex items-center justify-between p-3.5 cursor-pointer ${form.incluye_bano ? 'bg-orange-50 rounded-t-xl' : 'rounded-xl hover:border-gray-300'}`}>
                      <div className="pr-4">
                        <p className="font-semibold text-[#1B2A47] text-sm">Baño interior</p>
                        <p className="text-xs text-gray-500">Instalación sanitaria completa.</p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${form.incluye_bano ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow" />
                      </div>
                    </div>
                    {form.incluye_bano && (
                      <div className="p-3.5 pt-2">
                        <label className={labelClass}>Cantidad de baños</label>
                        <input type="number" min="1" className={inputClass} value={form.cantidad_banos} onChange={(e) => set('cantidad_banos', e.target.value)} placeholder="1" />
                      </div>
                    )}
                  </div>

                  <ToggleRow active={form.incluye_instalacion_electrica} onToggle={() => toggle('incluye_instalacion_electrica')}
                    title="Instalación eléctrica" desc="Tablero, bocas e iluminación de la nave." />

                  {/* Portones */}
                  <div className={`rounded-xl border-2 transition-all ${form.incluye_portones ? 'border-[#F05A28]' : 'border-gray-100'}`}>
                    <div onClick={() => toggle('incluye_portones')}
                      className={`flex items-center justify-between p-3.5 cursor-pointer ${form.incluye_portones ? 'bg-orange-50 rounded-t-xl' : 'rounded-xl hover:border-gray-300'}`}>
                      <div className="pr-4">
                        <p className="font-semibold text-[#1B2A47] text-sm">Portones</p>
                        <p className="text-xs text-gray-500">Portones corredizos metálicos de acceso.</p>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-all flex items-center px-1 shrink-0 ${form.incluye_portones ? 'bg-[#F05A28] justify-end' : 'bg-gray-200 justify-start'}`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow" />
                      </div>
                    </div>
                    {form.incluye_portones && (
                      <div className="p-3.5 pt-2">
                        <label className={labelClass}>Cantidad de portones</label>
                        <input type="number" min="1" className={inputClass} value={form.cantidad_portones} onChange={(e) => set('cantidad_portones', e.target.value)} placeholder="1" />
                      </div>
                    )}
                  </div>

                  <ToggleRow active={form.incluye_movimiento_suelo} onToggle={() => toggle('incluye_movimiento_suelo')}
                    title="Movimiento de suelo" desc="Nivelación / preparación del terreno." />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Documentación */}
        <div>
          <h3 className="font-semibold text-[#1B2A47] mb-3 text-sm uppercase tracking-wide">Documentación</h3>
          <button onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#F05A28] bg-orange-50/50 text-[#F05A28] rounded-xl py-4 font-semibold hover:bg-orange-50 transition-colors">
            <Paperclip className="w-5 h-5" />
            {docs.length > 0 ? `${docs.length} archivo${docs.length !== 1 ? 's' : ''} adjunto${docs.length !== 1 ? 's' : ''} — agregar más` : 'Subir documentación (planos, pliegos, fotos)'}
          </button>
          {docs.length > 0 && (
            <ul className="mt-3 space-y-2">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 truncate text-slate-700">{d.nombre}</span>
                  <span className="text-xs text-slate-400">{formatoBytes(d.tamanoBytes)}</span>
                  <button onClick={() => quitarDoc(i)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="text-sm rounded-lg px-4 py-2.5 bg-red-50 text-red-600 border border-red-100">{error}</div>}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-[#F05A28] text-white py-4 rounded-xl font-bold text-base hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-orange-200">
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando…</> : 'Enviar requerimientos'}
        </button>
        <p className="text-xs text-slate-400 text-center">
          Al enviar, nuestro equipo comercial recibe tu consulta y prepara el presupuesto. Te llegará una copia por email.
        </p>
      </div>

      {/* MODAL DE CARGA DE DOCUMENTACIÓN */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[#1B2A47]">Subir documentación</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#F05A28] bg-orange-50/50 rounded-2xl p-10 cursor-pointer hover:bg-orange-50 transition-colors flex flex-col items-center justify-center text-center">
                <UploadCloud className="h-10 w-10 text-[#F05A28] mb-3" />
                <span className="font-bold text-[#1B2A47]">Seleccioná archivos</span>
                <span className="text-xs text-gray-400 mt-1">PDF, imágenes, planos, Word/Excel — hasta {MAX_BYTES_POR_DOC / 1024 / 1024} MB c/u ({MAX_DOCS} máx.)</span>
                <input ref={fileRef} type="file" multiple className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,image/*"
                  onChange={(e) => handleFiles(e.target.files)} />
              </div>

              {docs.length > 0 && (
                <ul className="mt-4 space-y-2 max-h-52 overflow-y-auto">
                  {docs.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="flex-1 truncate text-slate-700">{d.nombre}</span>
                      <span className="text-xs text-slate-400">{formatoBytes(d.tamanoBytes)}</span>
                      <button onClick={() => quitarDoc(i)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
              {error && <div className="mt-3 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-600">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setModalOpen(false)}
                className="bg-[#1B2A47] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-700">
                Listo ({docs.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
