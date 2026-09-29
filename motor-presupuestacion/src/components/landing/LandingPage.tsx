'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import {
  ArrowRight, Building2, Factory, Hammer, Layers, MapPin, Ruler, ShieldCheck, Truck, Wrench,
  Phone, Mail, ChevronRight, CheckCircle2, MessageCircle,
} from 'lucide-react'
import BrandLogo from '@/components/branding/BrandLogo'
import type { Brand } from '@/lib/branding'

/* ─── Íconos disponibles para los servicios ──────────────────── */
// La config de marca elige por clave; si pide una que no existe, cae a Factory.
const ICONOS: Record<string, React.ElementType> = {
  factory: Factory,
  building: Building2,
  layers: Layers,
  wrench: Wrench,
  hammer: Hammer,
  ruler: Ruler,
  truck: Truck,
  shield: ShieldCheck,
}

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
    'w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl text-brand-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-shadow text-base'

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
        <h3 className="text-xl font-bold text-brand-ink mb-2">¡Mensaje enviado!</h3>
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
        className="w-full bg-brand text-white py-4 rounded-xl font-bold text-base hover:bg-brand-hover transition-all shadow-md shadow-brand-line/50 hover:-translate-y-0.5"
      >
        Enviar mensaje
      </button>
    </form>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */
// Sin datos de marca hardcodeados: todo lo visible viene de `brand`
// (config/brands/*.json + overrides BRAND_*). Ver src/lib/branding.ts.
export default function LandingPage({ brand }: { brand: Brand }) {
  const { hero, servicios, nosotros, clientes, contacto, ctaFinal } = brand

  const datosContacto = [
    { icon: <MapPin className="w-5 h-5 text-brand" />, label: 'Dirección', value: contacto.direccion },
    { icon: <Phone className="w-5 h-5 text-brand" />, label: 'Teléfono', value: contacto.telefono },
    { icon: <Mail className="w-5 h-5 text-brand" />, label: 'Email', value: contacto.email },
  ].filter(d => d.value)

  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-brand selection:text-white">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo brand={brand} />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#servicios" className="text-base font-semibold text-slate-600 hover:text-brand transition-colors">Servicios</a>
            <a href="#nosotros" className="text-base font-semibold text-slate-600 hover:text-brand transition-colors">Nosotros</a>
            <a href="#contacto" className="text-base font-semibold text-slate-600 hover:text-brand transition-colors">Contacto</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden md:inline-flex items-center gap-2 border-2 border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-all"
            >
              Portal comercial
            </Link>
            <Link
              href="/cotizar"
              className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-bold text-base hover:bg-brand-hover transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              {hero.cta} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">

        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
          {/* Fondo sutil */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 -z-10 w-[700px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--brand-primary) 12%, transparent) 0%, transparent 70%)' }}
          />

          <div className="max-w-4xl mx-auto px-8 text-center">
            {hero.badge && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-deep mb-10"
              >
                <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                {hero.badge}
              </motion.div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-6xl md:text-8xl font-black text-brand-ink tracking-tight leading-[1.05] mb-8"
            >
              {hero.tituloLinea1}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-light">
                {hero.tituloDestacado}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto mb-14 leading-relaxed font-medium"
            >
              {hero.subtitulo}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38 }}
              className="flex flex-col items-center gap-4"
            >
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-3 bg-brand text-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-brand-hover transition-colors shadow-lg shadow-brand-line"
              >
                {hero.cta}
                <ChevronRight className="w-6 h-6" />
              </Link>
              {hero.notaCta && (
                <p className="text-sm text-slate-400 font-medium">{hero.notaCta}</p>
              )}
              <Link
                href="/mi-proyecto/login"
                className="text-sm text-slate-500 hover:text-brand-ink font-semibold transition-colors underline underline-offset-4 decoration-slate-300 hover:decoration-current"
              >
                Hacer seguimiento de mi proyecto →
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── SERVICIOS ────────────────────────────────────── */}
        {servicios.items.length > 0 && (
          <section id="servicios" className="py-32 bg-brand-surface">
            <div className="max-w-7xl mx-auto px-8">
              <FadeUp className="text-center mb-20">
                <p className="text-sm font-bold uppercase tracking-widest text-brand mb-3">{servicios.eyebrow}</p>
                <h2 className="text-4xl md:text-5xl font-black text-brand-ink mb-5">{servicios.titulo}</h2>
                <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">{servicios.subtitulo}</p>
              </FadeUp>

              <div className="grid md:grid-cols-3 gap-8">
                {servicios.items.map((s, i) => {
                  const Icono = ICONOS[s.icono] ?? Factory
                  // Alternan entre el institucional y el de acento, como antes.
                  const chip = i % 2 === 0
                    ? 'bg-brand-ink-soft text-brand-ink group-hover:bg-brand-ink group-hover:text-white'
                    : 'bg-brand-soft text-brand group-hover:bg-brand group-hover:text-white'
                  return (
                    <FadeUp key={s.titulo} delay={i * 0.1}>
                      <div className="group bg-white rounded-3xl p-9 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 h-full flex flex-col border border-gray-100">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-7 transition-all duration-300 ${chip}`}>
                          <Icono size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-brand-ink mb-3">{s.titulo}</h3>
                        <p className="text-slate-500 leading-relaxed mb-6 flex-grow text-base">{s.desc}</p>
                        <ul className="space-y-2.5">
                          {s.items.map(item => (
                            <li key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                              <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </FadeUp>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── NOSOTROS / STATS ─────────────────────────────── */}
        <section id="nosotros" className="py-32 bg-brand-ink text-white relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full translate-x-1/3 -translate-y-1/3"
            style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--brand-primary) 18%, transparent) 0%, transparent 70%)' }}
          />
          <div className="max-w-7xl mx-auto px-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <FadeUp>
                <p className="text-sm font-bold uppercase tracking-widest text-brand mb-4">{nosotros.eyebrow}</p>
                <h2 className="text-4xl md:text-5xl font-black mb-7 leading-tight">{nosotros.titulo}</h2>
                <p className="text-brand-ink-tint text-lg leading-relaxed mb-10 font-medium">{nosotros.texto}</p>
                {nosotros.stats.length > 0 && (
                  <div className="grid grid-cols-3 gap-8">
                    {nosotros.stats.map(s => (
                      <div key={s.label}>
                        <div className="text-4xl font-black text-brand mb-1">{s.num}</div>
                        <div className="text-sm font-semibold text-brand-ink-tint-strong leading-snug">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </FadeUp>

              <FadeUp delay={0.15}>
                <div className="relative">
                  <div className="absolute inset-0 bg-brand rounded-3xl translate-x-3 translate-y-3 opacity-60" />
                  <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl overflow-hidden aspect-video flex items-center justify-center border border-white/20">
                    {nosotros.imagen
                      ? <img src={nosotros.imagen} alt={brand.nombre} className="w-full h-full object-cover" />
                      : <p className="text-white/40 font-bold text-lg">[ Imagen Institucional ]</p>}
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </section>

        {/* ── CLIENTES ─────────────────────────────────────── */}
        {clientes.logos.length > 0 && (
          <section className="py-20 bg-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-8 text-center">
              <FadeUp>
                <p className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-10">{clientes.titulo}</p>
                <div className="flex flex-wrap justify-center items-center gap-14 text-slate-300">
                  {clientes.logos.map(c => (
                    <span key={c} className="text-2xl font-black tracking-tight hover:text-slate-500 transition-colors cursor-default">
                      {c}
                    </span>
                  ))}
                </div>
              </FadeUp>
            </div>
          </section>
        )}

        {/* ── CONTACTO ─────────────────────────────────────── */}
        <section id="contacto" className="py-32 bg-brand-surface">
          <div className="max-w-7xl mx-auto px-8">
            <FadeUp className="text-center mb-20">
              <p className="text-sm font-bold uppercase tracking-widest text-brand mb-3">{contacto.eyebrow}</p>
              <h2 className="text-4xl md:text-5xl font-black text-brand-ink mb-5">{contacto.titulo}</h2>
              <p className="text-xl text-slate-500 max-w-xl mx-auto font-medium">{contacto.subtitulo}</p>
            </FadeUp>

            <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto items-start">

              {/* Info de contacto */}
              <FadeUp>
                <div className="space-y-6">
                  {datosContacto.map(item => (
                    <div key={item.label} className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                      <div className="w-10 h-10 bg-brand-soft rounded-xl flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">{item.label}</p>
                        <p className="font-semibold text-brand-ink text-base">{item.value}</p>
                      </div>
                    </div>
                  ))}

                  {contacto.whatsapp && (
                    <a
                      href={`https://wa.me/${contacto.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 bg-[#25D366] text-white px-6 py-4 rounded-2xl font-bold text-base hover:bg-green-500 transition-all shadow-md shadow-green-100 hover:shadow-green-200 hover:-translate-y-0.5 w-full justify-center"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Escribinos por WhatsApp
                    </a>
                  )}
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
        <section className="py-28 bg-gradient-to-br from-brand to-brand-hover relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-[500px] h-[400px] rounded-full translate-x-1/2 translate-y-1/2" style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
          <FadeUp className="max-w-3xl mx-auto px-8 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
              {ctaFinal.titulo}
            </h2>
            <p className="text-xl text-brand-tint mb-12 font-medium">{ctaFinal.subtitulo}</p>
            <Link
              href="/cotizar"
              className="inline-flex items-center gap-3 bg-white text-brand px-12 py-5 rounded-2xl font-black text-xl hover:bg-gray-50 transition-all shadow-2xl hover:scale-105 hover:-translate-y-1"
            >
              {ctaFinal.boton}
              <ChevronRight className="w-6 h-6" />
            </Link>
          </FadeUp>
        </section>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-brand-ink-deep py-14 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <Link href="/" className="flex items-center gap-3 opacity-90 hover:opacity-100 transition-opacity">
              <BrandLogo brand={brand} variante="oscuro" alto={40} />
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
              © {new Date().getFullYear()} {brand.razonSocial}
              {brand.footerNota && ` · ${brand.footerNota}`}
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
