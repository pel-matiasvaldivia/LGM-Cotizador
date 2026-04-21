'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import {
  ArrowRight, Building2, Factory, Layers, MapPin,
  Phone, Mail, ChevronRight, CheckCircle2, MessageCircle
} from 'lucide-react'

/* ─── Animation helpers ──────────────────────────────────────── */
function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* ─── Contact form ───────────────────────────────────────────── */
function ContactForm() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  const input =
    'w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl text-[#1B2A47] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F05A28] focus:border-transparent transition-shadow text-base'

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-[#1B2A47] mb-2">¡Mensaje enviado!</h3>
        <p className="text-slate-500">Nos pondremos en contacto a la brevedad.</p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Nombre</label>
          <input
            type="text" required placeholder="Juan García"
            value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Email</label>
          <input
            type="email" required placeholder="juan@empresa.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className={input}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Mensaje</label>
        <textarea
          required rows={4} placeholder="Contanos sobre tu proyecto..."
          value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })}
          className={`${input} resize-none`}
        />
      </div>
      <button
        type="submit"
        className="w-full bg-[#F05A28] text-white py-4 rounded-xl font-bold text-base hover:bg-orange-600 transition-all shadow-md shadow-orange-100 hover:shadow-orange-200 hover:-translate-y-0.5"
      >
        Enviar mensaje
      </button>
    </form>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-[#F05A28] selection:text-white">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Log Metal" className="h-12 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#servicios" className="text-base font-semibold text-slate-600 hover:text-[#F05A28] transition-colors">Servicios</a>
            <a href="#nosotros" className="text-base font-semibold text-slate-600 hover:text-[#F05A28] transition-colors">Nosotros</a>
            <a href="#contacto" className="text-base font-semibold text-slate-600 hover:text-[#F05A28] transition-colors">Contacto</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden md:inline-flex items-center gap-2 border-2 border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-semibold text-sm hover:border-[#1B2A47] hover:text-[#1B2A47] transition-all"
            >
              Portal comercial
            </Link>
            <Link
              href="/cotizar"
              className="inline-flex items-center gap-2 bg-[#F05A28] text-white px-6 py-3 rounded-xl font-bold text-base hover:bg-orange-600 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              Cotizar proyecto <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">

        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
          {/* Fondo sutil */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 -z-10 w-[700px] h-[500px] rounded-full" style={{ background: 'radial-gradient(ellipse at center, rgba(240,90,40,0.12) 0%, transparent 70%)' }} />

          <div className="max-w-4xl mx-auto px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-semibold text-orange-700 mb-10"
            >
              <span className="w-2 h-2 rounded-full bg-[#F05A28] animate-pulse" />
              Líderes en construcción industrial desde 2005
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-6xl md:text-8xl font-black text-[#1B2A47] tracking-tight leading-[1.05] mb-8"
            >
              Construimos<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F05A28] to-orange-400">
                tu espacio.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto mb-14 leading-relaxed font-medium"
            >
              Diseño, ingeniería, fabricación y montaje de naves industriales.<br className="hidden md:block" />
              Cotizá tu proyecto en minutos con inteligencia artificial.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38 }}
              className="flex flex-col items-center gap-4"
            >
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-3 bg-[#F05A28] text-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
              >
                Cotizar proyecto
                <ChevronRight className="w-6 h-6" />
              </Link>
              <p className="text-sm text-slate-400 font-medium">
                Sin compromiso · Resultado en 2 minutos
              </p>
              <Link
                href="/mi-proyecto/login"
                className="text-sm text-slate-500 hover:text-[#1B2A47] font-semibold transition-colors underline underline-offset-4 decoration-slate-300 hover:decoration-[#1B2A47]"
              >
                Hacer seguimiento de mi proyecto →
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── SERVICIOS ────────────────────────────────────── */}
        <section id="servicios" className="py-32 bg-[#F4F5F7]">
          <div className="max-w-7xl mx-auto px-8">
            <FadeUp className="text-center mb-20">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F05A28] mb-3">Servicios</p>
              <h2 className="text-4xl md:text-5xl font-black text-[#1B2A47] mb-5">Lo que hacemos</h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
                Soluciones integrales de infraestructura metálica para cualquier escala y sector.
              </p>
            </FadeUp>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Factory size={32} />,
                  title: 'Naves Industriales',
                  desc: 'Sistemas Alveolar, Alma Llena y Reticulado. Rápido montaje, grandes luces sin columnas intermedias.',
                  items: ['Sistema Kit económico', 'Sin soldaduras en obra', 'Grandes luces libres'],
                  color: 'bg-blue-50 text-[#1B2A47] group-hover:bg-[#1B2A47] group-hover:text-white',
                },
                {
                  icon: <Building2 size={32} />,
                  title: 'Edificios Corporativos',
                  desc: 'Arquitectura metálica moderna para oficinas y espacios comerciales de vanguardia.',
                  items: ['Diseño arquitectónico', 'Estructura sismo-resistente', 'Llave en mano'],
                  color: 'bg-orange-50 text-[#F05A28] group-hover:bg-[#F05A28] group-hover:text-white',
                },
                {
                  icon: <Layers size={32} />,
                  title: 'Soluciones Modulares',
                  desc: 'Unidades transportables y modulares de rápida implantación. Habitacional y comercial.',
                  items: ['Rápida instalación', 'Bajo mantenimiento', 'Alta durabilidad'],
                  color: 'bg-blue-50 text-[#1B2A47] group-hover:bg-[#1B2A47] group-hover:text-white',
                },
              ].map((s, i) => (
                <FadeUp key={s.title} delay={i * 0.1}>
                  <div className="group bg-white rounded-3xl p-9 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 h-full flex flex-col border border-gray-100">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-7 transition-all duration-300 ${s.color}`}>
                      {s.icon}
                    </div>
                    <h3 className="text-xl font-bold text-[#1B2A47] mb-3">{s.title}</h3>
                    <p className="text-slate-500 leading-relaxed mb-6 flex-grow text-base">{s.desc}</p>
                    <ul className="space-y-2.5">
                      {s.items.map(item => (
                        <li key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-[#F05A28] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── NOSOTROS / STATS ─────────────────────────────── */}
        <section id="nosotros" className="py-32 bg-[#1B2A47] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full translate-x-1/3 -translate-y-1/3" style={{ background: 'radial-gradient(ellipse at center, rgba(240,90,40,0.18) 0%, transparent 70%)' }} />
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <FadeUp>
                <p className="text-sm font-bold uppercase tracking-widest text-[#F05A28] mb-4">Nosotros</p>
                <h2 className="text-4xl md:text-5xl font-black mb-7 leading-tight">
                  Ingeniería que respalda<br />tu inversión
                </h2>
                <p className="text-blue-200 text-lg leading-relaxed mb-10 font-medium">
                  Log Metal SRL nace en 2005 como fabricante de estructuras metálicas. Hoy ofrecemos servicios integrales desde el diseño y la ingeniería, hasta la fabricación, montaje y ejecución llave en mano en toda Argentina.
                </p>
                <div className="grid grid-cols-3 gap-8">
                  {[
                    { num: '+20', label: 'Años de trayectoria' },
                    { num: '+500', label: 'Proyectos ejecutados' },
                    { num: '100%', label: 'Cobertura nacional' },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="text-4xl font-black text-[#F05A28] mb-1">{s.num}</div>
                      <div className="text-sm font-semibold text-blue-300 leading-snug">{s.label}</div>
                    </div>
                  ))}
                </div>
              </FadeUp>

              <FadeUp delay={0.15}>
                <div className="relative">
                  <div className="absolute inset-0 bg-[#F05A28] rounded-3xl translate-x-3 translate-y-3 opacity-60" />
                  <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl overflow-hidden aspect-video flex items-center justify-center border border-white/20">
                    <p className="text-white/40 font-bold text-lg">[ Imagen Institucional ]</p>
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </section>

        {/* ── CLIENTES ─────────────────────────────────────── */}
        <section className="py-20 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <FadeUp>
              <p className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-10">Empresas que confían en nosotros</p>
              <div className="flex flex-wrap justify-center items-center gap-14 text-slate-300">
                {['WEATHERFORD', 'VOLKSWAGEN', 'TOYOTA', 'BIOAGIL'].map(c => (
                  <span key={c} className="text-2xl font-black tracking-tight hover:text-slate-500 transition-colors cursor-default">
                    {c}
                  </span>
                ))}
              </div>
            </FadeUp>
          </div>
        </section>

        {/* ── CONTACTO ─────────────────────────────────────── */}
        <section id="contacto" className="py-32 bg-[#F4F5F7]">
          <div className="max-w-7xl mx-auto px-8">
            <FadeUp className="text-center mb-20">
              <p className="text-sm font-bold uppercase tracking-widest text-[#F05A28] mb-3">Contacto</p>
              <h2 className="text-4xl md:text-5xl font-black text-[#1B2A47] mb-5">Hablemos de tu proyecto</h2>
              <p className="text-xl text-slate-500 max-w-xl mx-auto font-medium">
                Completá el formulario o contactanos directamente. Respondemos en menos de 24 horas.
              </p>
            </FadeUp>

            <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto items-start">

              {/* Info de contacto */}
              <FadeUp>
                <div className="space-y-6">
                  {[
                    {
                      icon: <MapPin className="w-5 h-5 text-[#F05A28]" />,
                      label: 'Dirección',
                      value: 'Parque Industrial, Mendoza, Argentina',
                    },
                    {
                      icon: <Phone className="w-5 h-5 text-[#F05A28]" />,
                      label: 'Teléfono',
                      value: '+54 9 261 XXX-XXXX',
                    },
                    {
                      icon: <Mail className="w-5 h-5 text-[#F05A28]" />,
                      label: 'Email',
                      value: 'info@logmetal.com.ar',
                    },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                      <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">{item.label}</p>
                        <p className="font-semibold text-[#1B2A47] text-base">{item.value}</p>
                      </div>
                    </div>
                  ))}

                  <a
                    href="https://wa.me/5492616666666"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold text-base hover:bg-green-500 transition-all shadow-md shadow-green-100 hover:shadow-green-200 hover:-translate-y-0.5 w-full justify-center"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Escribinos por WhatsApp
                  </a>
                </div>
              </FadeUp>

              {/* Formulario */}
              <FadeUp delay={0.1}>
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                  <ContactForm />
                </div>
              </FadeUp>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ────────────────────────────────────── */}
        <section className="py-28 bg-gradient-to-br from-[#F05A28] to-orange-500 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-[500px] h-[400px] rounded-full translate-x-1/2 translate-y-1/2" style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
          <FadeUp className="max-w-3xl mx-auto px-8 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              ¿Listo para construir?
            </h2>
            <p className="text-xl text-orange-100 mb-12 font-medium">
              Usá nuestro cotizador inteligente y recibí un presupuesto detallado en minutos.
            </p>
            <Link
              href="/cotizar"
              className="inline-flex items-center gap-3 bg-white text-[#F05A28] px-12 py-5 rounded-2xl font-black text-xl hover:bg-gray-50 transition-all shadow-2xl hover:scale-105 hover:-translate-y-1"
            >
              Cotizar proyecto
              <ChevronRight className="w-6 h-6" />
            </Link>
          </FadeUp>
        </section>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-[#0f172a] py-14 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="Log Metal" className="h-10 w-auto opacity-90 hover:opacity-100 transition-opacity" />
            </Link>
            <nav className="flex gap-8">
              {['Servicios', 'Nosotros', 'Contacto'].map(link => (
                <a
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  {link}
                </a>
              ))}
            </nav>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Log Metal SRL · Mendoza, Argentina
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
