'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'

// Configuración de la empresa (multi-tenant). Lo que se guarda acá es lo que ve
// el visitante en la landing y, sobre todo, lo que sale impreso en el
// presupuesto: razón social, CUIT, domicilio y contacto.
//
// Los dominios que resuelven a esta empresa no se editan desde el panel: son
// configuración de plataforma (scripts/tenant.mjs).

type Logo = { mime: string; base64: string } | null

type Stat = { num: string; label: string }
type Servicio = { icono: string; titulo: string; desc: string; items: string[] }

type Landing = {
  meta?: { title?: string; description?: string }
  hero?: {
    badge?: string
    tituloLinea1?: string
    tituloDestacado?: string
    subtitulo?: string
    cta?: string
    notaCta?: string
  }
  servicios?: { titulo?: string; subtitulo?: string; items?: Servicio[] }
  nosotros?: { titulo?: string; texto?: string; stats?: Stat[] }
  clientes?: { titulo?: string; logos?: string[] }
  contacto?: { titulo?: string; subtitulo?: string }
  ctaFinal?: { titulo?: string; subtitulo?: string; boton?: string }
  footerNota?: string
}

type Empresa = {
  slug: string
  nombre: string
  razonSocial: string
  tagline: string
  cuit: string
  condicionIva: string
  ingresosBrutos: string
  inicioActividades: string
  domicilio: string
  localidad: string
  provincia: string
  codigoPostal: string
  telefono: string
  email: string
  web: string
  whatsapp: string
  colorPrimario: string
  colorInk: string
  colorSurface: string
  logoAlto: number
  tieneLogo: boolean
  tieneLogoOscuro: boolean
  landing: Landing
  actualizado: string
}

const ICONOS = ['factory', 'building', 'layers', 'wrench', 'hammer', 'ruler', 'truck', 'shield']

const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
  'No Responsable',
]

const input =
  'block w-full rounded-lg border border-gray-200 bg-white p-2.5 text-brand-ink focus:ring-2 focus:ring-brand focus:border-transparent outline-none text-sm'

// Definidos a nivel de módulo para que React no los desmonte en cada tecla (si
// no, el input pierde el foco tras cada letra).
function Campo({
  label,
  value,
  onChange,
  placeholder,
  ayuda,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ayuda?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={value} placeholder={placeholder} className={input}
             onChange={(e) => onChange(e.target.value)} />
      {ayuda && <p className="text-xs text-slate-400 mt-1">{ayuda}</p>}
    </div>
  )
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <textarea rows={rows} value={value} className={`${input} resize-y`}
                onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Color({
  label,
  value,
  fallback,
  onChange,
  ayuda,
}: {
  label: string
  value: string
  fallback: string
  onChange: (v: string) => void
  ayuda?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          placeholder={`${fallback} (por defecto)`}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} title="Volver al color por defecto"
                  className="text-slate-400 hover:text-brand-ink text-xs font-semibold px-2">
            Limpiar
          </button>
        )}
      </div>
      {ayuda && <p className="text-xs text-slate-400 mt-1">{ayuda}</p>}
    </div>
  )
}

function Seccion({ titulo, desc, children }: { titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-semibold text-brand-ink mb-1">{titulo}</h2>
      {desc && <p className="text-xs text-slate-400 mb-4">{desc}</p>}
      <div className={desc ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

// Carga un archivo de imagen como base64 (se guarda en la base, no en disco).
function leerImagen(file: File): Promise<{ mime: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      const url = String(reader.result || '')
      const coma = url.indexOf(',')
      resolve({ mime: file.type, base64: url.slice(coma + 1) })
    }
    reader.readAsDataURL(file)
  })
}

function SubirLogo({
  label,
  ayuda,
  tiene,
  preview,
  pendiente,
  onArchivo,
  onBorrar,
}: {
  label: string
  ayuda: string
  tiene: boolean
  preview: string
  pendiente: Logo | undefined
  onArchivo: (l: Logo) => void
  onBorrar: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const src = pendiente ? `data:${pendiente.mime};base64,${pendiente.base64}` : tiene ? preview : ''

  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-4">
        <div className="h-16 w-36 rounded-lg border border-dashed border-gray-200 bg-slate-50 flex items-center justify-center overflow-hidden">
          {src
            ? <img src={src} alt={label} className="max-h-14 max-w-32 object-contain" />
            : <span className="text-[11px] text-slate-400">sin logo</span>}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => ref.current?.click()}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-hover">
            <Upload className="w-4 h-4" /> Elegir archivo
          </button>
          {(src || pendiente) && (
            <button type="button" onClick={() => { onBorrar(); if (ref.current) ref.current.value = '' }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" /> Quitar
            </button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setError('')
            if (file.size > 512 * 1024) {
              setError('El archivo supera los 512 KB')
              return
            }
            try {
              onArchivo(await leerImagen(file))
            } catch {
              setError('No se pudo leer el archivo')
            }
          }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{ayuda}</p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export default function EmpresaPage() {
  const [e, setE] = useState<Empresa | null>(null)
  const [logo, setLogo] = useState<Logo | undefined>(undefined)
  const [logoOscuro, setLogoOscuro] = useState<Logo | undefined>(undefined)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/empresa')
      .then((r) => r.json())
      .then((d) => (d.empresa ? setE(d.empresa) : setError(d.error || 'No se pudo cargar')))
      .catch(() => setError('No se pudieron cargar los datos de la empresa'))
  }, [])

  const set = <K extends keyof Empresa>(k: K, v: Empresa[K]) =>
    setE((prev) => (prev ? { ...prev, [k]: v } : prev))

  // Editor de los textos de la landing: se guarda un objeto parcial; lo que no
  // se escribe cae a los textos por defecto.
  const setLanding = (patch: Landing) =>
    setE((prev) => (prev ? { ...prev, landing: { ...prev.landing, ...patch } } : prev))

  const L = e?.landing ?? {}
  const servicios = L.servicios?.items ?? []
  const stats = L.nosotros?.stats ?? []

  async function guardar() {
    if (!e) return
    setGuardando(true)
    setMsg(null)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        nombre: e.nombre,
        razonSocial: e.razonSocial,
        tagline: e.tagline,
        cuit: e.cuit,
        condicionIva: e.condicionIva,
        ingresosBrutos: e.ingresosBrutos,
        inicioActividades: e.inicioActividades,
        domicilio: e.domicilio,
        localidad: e.localidad,
        provincia: e.provincia,
        codigoPostal: e.codigoPostal,
        telefono: e.telefono,
        email: e.email,
        web: e.web,
        whatsapp: e.whatsapp,
        colorPrimario: e.colorPrimario,
        colorInk: e.colorInk,
        colorSurface: e.colorSurface,
        logoAlto: e.logoAlto,
        landing: e.landing,
      }
      // undefined = no tocar; null = borrar el actual
      if (logo !== undefined) body.logo = logo
      if (logoOscuro !== undefined) body.logoOscuro = logoOscuro

      const res = await fetch('/api/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setMsg('Datos guardados. Recargá la página para ver la marca actualizada.')
      setLogo(undefined)
      setLogoOscuro(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (error && !e) return <div className="max-w-4xl mx-auto p-6 text-red-600">{error}</div>
  if (!e) return <div className="max-w-4xl mx-auto p-6 text-slate-400">Cargando datos de la empresa…</div>

  const version = encodeURIComponent(e.actualizado)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-brand-ink mb-1">Empresa</h1>
      <p className="text-slate-500 mb-6 text-sm">
        Identidad y datos fiscales de <strong>{e.nombre}</strong>. Es lo que ve el cliente en el sitio
        y lo que sale impreso en el encabezado y el pie del presupuesto.
      </p>

      <div className="space-y-5">
        <Seccion titulo="Identidad" desc="Nombre comercial y razón social. La razón social es la que firma el presupuesto.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Nombre comercial" value={e.nombre} onChange={(v) => set('nombre', v)}
                   ayuda="Se usa como logo de texto si no cargás una imagen." />
            <Campo label="Razón social" value={e.razonSocial} onChange={(v) => set('razonSocial', v)}
                   placeholder="Acero Sur S.A." />
            <Campo label="Bajada / rubro" value={e.tagline} onChange={(v) => set('tagline', v)}
                   placeholder="NAVES INDUSTRIALES" ayuda="Aparece junto al logo en los mails." />
          </div>
        </Seccion>

        <Seccion titulo="Datos fiscales" desc="Se imprimen en el presupuesto: el CUIT en el encabezado, el resto en el pie.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="CUIT" value={e.cuit} onChange={(v) => set('cuit', v)} placeholder="30-12345678-9" />
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Condición frente al IVA</label>
              <input list="condiciones-iva" value={e.condicionIva} className={input}
                     onChange={(ev) => set('condicionIva', ev.target.value)} placeholder="Responsable Inscripto" />
              <datalist id="condiciones-iva">
                {CONDICIONES_IVA.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <Campo label="Ingresos Brutos" value={e.ingresosBrutos} onChange={(v) => set('ingresosBrutos', v)}
                   placeholder="Convenio Multilateral 901-123456-7" />
            <Campo label="Inicio de actividades" value={e.inicioActividades}
                   onChange={(v) => set('inicioActividades', v)} placeholder="01/03/2005" />
          </div>
        </Seccion>

        <Seccion titulo="Domicilio" desc="Domicilio comercial/legal. Se imprime en el encabezado del presupuesto y se muestra en la sección de contacto del sitio.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Calle y número" value={e.domicilio} onChange={(v) => set('domicilio', v)}
                   placeholder="Av. San Martín 1234" />
            <Campo label="Localidad" value={e.localidad} onChange={(v) => set('localidad', v)} placeholder="Godoy Cruz" />
            <Campo label="Provincia" value={e.provincia} onChange={(v) => set('provincia', v)} placeholder="Mendoza" />
            <Campo label="Código postal" value={e.codigoPostal} onChange={(v) => set('codigoPostal', v)} placeholder="M5501" />
          </div>
        </Seccion>

        <Seccion titulo="Contacto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Teléfono" value={e.telefono} onChange={(v) => set('telefono', v)} placeholder="+54 9 261 123-4567" />
            <Campo label="Email" value={e.email} onChange={(v) => set('email', v)} type="email"
                   placeholder="ventas@empresa.com" />
            <Campo label="Sitio web" value={e.web} onChange={(v) => set('web', v)} placeholder="www.empresa.com" />
            <Campo label="WhatsApp" value={e.whatsapp} onChange={(v) => set('whatsapp', v)}
                   placeholder="5492611234567"
                   ayuda="Formato internacional, sin + ni espacios. Vacío oculta el botón del sitio." />
          </div>
        </Seccion>

        <Seccion titulo="Identidad visual" desc="Con el color de acento y el institucional queda resuelta la paleta entera: los hovers, fondos suaves y bordes se derivan de esos dos.">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Color label="Color de acento" value={e.colorPrimario} fallback="#2563eb"
                     onChange={(v) => set('colorPrimario', v)} ayuda="Botones, links, destacados." />
              <Color label="Color institucional" value={e.colorInk} fallback="#1e293b"
                     onChange={(v) => set('colorInk', v)} ayuda="Títulos y secciones oscuras." />
              <Color label="Gris de fondo" value={e.colorSurface} fallback="#f4f5f7"
                     onChange={(v) => set('colorSurface', v)} ayuda="Secciones alternadas." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SubirLogo
                label="Logo" ayuda="PNG, JPG, WEBP o SVG, hasta 512 KB. Para el PDF usá PNG o JPG."
                tiene={e.tieneLogo} preview={`/api/brand/logo?v=${version}`}
                pendiente={logo} onArchivo={(l) => setLogo(l)} onBorrar={() => setLogo(null)}
              />
              <SubirLogo
                label="Logo para fondo oscuro" ayuda="Versión en blanco, para el pie del sitio y el panel."
                tiene={e.tieneLogoOscuro} preview={`/api/brand/logo?variante=oscuro&v=${version}`}
                pendiente={logoOscuro} onArchivo={(l) => setLogoOscuro(l)} onBorrar={() => setLogoOscuro(null)}
              />
            </div>

            <div className="md:w-1/3">
              <Campo label="Alto del logo (px)" type="number" value={String(e.logoAlto)}
                     onChange={(v) => set('logoAlto', Number(v) || 48)}
                     ayuda="Entre 16 y 160. Un logo apaisado necesita menos alto que uno cuadrado." />
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Textos del sitio" desc="Lo que no completes usa el texto por defecto.">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Título del navegador" value={L.meta?.title ?? ''}
                     onChange={(v) => setLanding({ meta: { ...L.meta, title: v } })} />
              <Campo label="Descripción (SEO)" value={L.meta?.description ?? ''}
                     onChange={(v) => setLanding({ meta: { ...L.meta, description: v } })} />
              <Campo label="Cintillo del hero" value={L.hero?.badge ?? ''}
                     onChange={(v) => setLanding({ hero: { ...L.hero, badge: v } })}
                     placeholder="Fabricantes desde 1998" />
              <Campo label="Nota bajo el botón" value={L.hero?.notaCta ?? ''}
                     onChange={(v) => setLanding({ hero: { ...L.hero, notaCta: v } })} />
              <Campo label="Título (primera línea)" value={L.hero?.tituloLinea1 ?? ''}
                     onChange={(v) => setLanding({ hero: { ...L.hero, tituloLinea1: v } })}
                     placeholder="Construimos" />
              <Campo label="Título (palabra destacada)" value={L.hero?.tituloDestacado ?? ''}
                     onChange={(v) => setLanding({ hero: { ...L.hero, tituloDestacado: v } })}
                     placeholder="tu espacio." />
            </div>
            <Area label="Subtítulo del hero" value={L.hero?.subtitulo ?? ''} rows={2}
                  onChange={(v) => setLanding({ hero: { ...L.hero, subtitulo: v } })} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Título de “Nosotros”" value={L.nosotros?.titulo ?? ''}
                     onChange={(v) => setLanding({ nosotros: { ...L.nosotros, titulo: v } })} />
              <Campo label="Título del cierre" value={L.ctaFinal?.titulo ?? ''}
                     onChange={(v) => setLanding({ ctaFinal: { ...L.ctaFinal, titulo: v } })}
                     placeholder="¿Listo para construir?" />
            </div>
            <Area label="Texto de “Nosotros”" value={L.nosotros?.texto ?? ''}
                  onChange={(v) => setLanding({ nosotros: { ...L.nosotros, texto: v } })} />

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Métricas</label>
              <p className="text-xs text-slate-400 mb-2">Hasta 3. Si las dejás vacías, la sección no las muestra.</p>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input className={input} placeholder="+20" value={stats[i]?.num ?? ''}
                           onChange={(ev) => {
                             const next = [0, 1, 2].map((j) => ({ ...(stats[j] ?? { num: '', label: '' }) }))
                             next[i].num = ev.target.value
                             setLanding({ nosotros: { ...L.nosotros, stats: next.filter((s) => s.num || s.label) } })
                           }} />
                    <input className={`${input} col-span-2`} placeholder="Años de trayectoria"
                           value={stats[i]?.label ?? ''}
                           onChange={(ev) => {
                             const next = [0, 1, 2].map((j) => ({ ...(stats[j] ?? { num: '', label: '' }) }))
                             next[i].label = ev.target.value
                             setLanding({ nosotros: { ...L.nosotros, stats: next.filter((s) => s.num || s.label) } })
                           }} />
                  </div>
                ))}
              </div>
            </div>

            <Campo label="Clientes (separados por coma)" value={(L.clientes?.logos ?? []).join(', ')}
                   onChange={(v) => setLanding({
                     clientes: { ...L.clientes, logos: v.split(',').map((x) => x.trim()).filter(Boolean) },
                   })}
                   ayuda="Se muestran como texto. Vacío oculta la sección." />
          </div>
        </Seccion>

        <Seccion titulo="Servicios" desc="Las tarjetas del sitio. Sin ninguna, se muestran las que trae el sistema por defecto.">
          <div className="space-y-4">
            {servicios.map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Servicio {i + 1}</span>
                  <button type="button" className="text-slate-400 hover:text-red-600"
                          onClick={() => setLanding({
                            servicios: { ...L.servicios, items: servicios.filter((_, j) => j !== i) },
                          })}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Ícono</label>
                    <select className={input} value={s.icono}
                            onChange={(ev) => {
                              const items = servicios.map((x, j) => j === i ? { ...x, icono: ev.target.value } : x)
                              setLanding({ servicios: { ...L.servicios, items } })
                            }}>
                      {ICONOS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Campo label="Título" value={s.titulo}
                           onChange={(v) => {
                             const items = servicios.map((x, j) => j === i ? { ...x, titulo: v } : x)
                             setLanding({ servicios: { ...L.servicios, items } })
                           }} />
                  </div>
                </div>
                <Area label="Descripción" rows={2} value={s.desc}
                      onChange={(v) => {
                        const items = servicios.map((x, j) => j === i ? { ...x, desc: v } : x)
                        setLanding({ servicios: { ...L.servicios, items } })
                      }} />
                <Campo label="Viñetas (separadas por coma)" value={(s.items ?? []).join(', ')}
                       onChange={(v) => {
                         const items = servicios.map((x, j) =>
                           j === i ? { ...x, items: v.split(',').map((t) => t.trim()).filter(Boolean) } : x)
                         setLanding({ servicios: { ...L.servicios, items } })
                       }} />
              </div>
            ))}
            {servicios.length < 6 && (
              <button
                type="button"
                onClick={() => setLanding({
                  servicios: {
                    ...L.servicios,
                    items: [...servicios, { icono: 'factory', titulo: '', desc: '', items: [] }],
                  },
                })}
                className="text-sm font-semibold text-brand hover:text-brand-hover"
              >
                + Agregar servicio
              </button>
            )}
          </div>
        </Seccion>

        {msg && <div className="text-sm rounded-lg px-4 py-2 bg-emerald-50 text-emerald-700">{msg}</div>}
        {error && <div className="text-sm rounded-lg px-4 py-2 bg-red-50 text-red-700">{error}</div>}

        <div className="flex items-center gap-4 pb-10">
          <button onClick={guardar} disabled={guardando}
                  className="bg-brand text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-hover disabled:opacity-40">
            {guardando ? 'Guardando…' : 'Guardar datos de la empresa'}
          </button>
          <span className="text-xs text-slate-400">
            Dominio y facturación del servicio se administran aparte.
          </span>
        </div>
      </div>
    </div>
  )
}
