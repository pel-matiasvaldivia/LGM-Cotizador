import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { proyectos as proyectosTable, presupuestoBaseItems } from '@/db/schema'
import { datosTecnicosToRow, proyectoToRow } from '@/lib/serializers'
import { getCurrentUser } from '@/lib/auth'
import { calcularResumen } from '@/lib/calculator'
import { getParametros } from '@/lib/parametros'
import { linkReunion } from '@/lib/email'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/auth/LogoutButton'
import PreaprobarOferta from '@/components/cliente/PreaprobarOferta'
import { CheckCircle2, Circle, Clock, FileText, Download } from 'lucide-react'

const ESTADOS = ['borrador', 'enviado', 'preaprobado', 'aprobado'] as const

// Estados en los que el cliente ya puede ver y descargar su presupuesto.
const ESTADOS_CON_PRESUPUESTO = ['enviado', 'preaprobado', 'aprobado']

const estadoInfo: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  borrador:    { label: 'Recibido',     desc: 'Tu solicitud fue recibida y está siendo revisada por nuestro equipo.',          color: 'text-slate-600',  bg: 'bg-slate-100' },
  enviado:     { label: 'Presupuesto',  desc: '¡Tu presupuesto ya está disponible! Podés verlo y descargarlo desde acá.',      color: 'text-blue-700',   bg: 'bg-blue-100' },
  preaprobado: { label: 'Preaprobado',  desc: 'Tu presupuesto está listo. Nos pondremos en contacto para coordinar la reunión.', color: 'text-amber-700',  bg: 'bg-amber-100' },
  aprobado:    { label: 'Aprobado',     desc: '¡Proyecto aprobado! El equipo de Log Metal estará en contacto para comenzar.',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
}

const usd = (n: number) => '$ ' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' USD'

export default async function MiProyectoPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/mi-proyecto/login')
  }

  const filas = await db.query.proyectos.findMany({
    where: eq(proyectosTable.email, user.email),
    orderBy: desc(proyectosTable.createdAt),
    with: { datosTecnicos: true },
  })

  const primero = filas[0] ?? null
  const proyecto = primero
    ? { ...proyectoToRow(primero), datos_tecnicos: primero.datosTecnicos.map(datosTecnicosToRow) }
    : null

  const estadoIndex = proyecto ? ESTADOS.indexOf(proyecto.estado as any) : -1

  // Si el presupuesto ya fue enviado, calculamos el resumen de venta para
  // mostrarle al cliente el total y el precio por m² (sin exponer costos).
  const mostrarPresupuesto = !!primero && !!proyecto && ESTADOS_CON_PRESUPUESTO.includes(proyecto.estado)
  let resumen: ReturnType<typeof calcularResumen> | null = null
  if (mostrarPresupuesto && primero) {
    const items = await db.query.presupuestoBaseItems.findMany({
      where: eq(presupuestoBaseItems.proyectoId, primero.id),
      with: { subrubro: { with: { rubro: true } } },
      orderBy: asc(presupuestoBaseItems.orden),
    })
    if (items.length > 0) {
      const params = await getParametros()
      const superficie = primero.datosTecnicos[0]?.superficie ?? 0
      resumen = calcularResumen(items, params, superficie, primero.ubicacion)
    }
  }
  const superficieM2 = Number(primero?.datosTecnicos[0]?.superficie ?? 0)
  const precioM2 = resumen && superficieM2 > 0 ? resumen.totalConIvaUsd / superficieM2 : 0
  const reunionUrl = primero ? linkReunion(primero) : null

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Log Metal" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">{user.email}</span>
            <LogoutButton redirectTo="/mi-proyecto/login" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-[#1B2A47]">Mi proyecto</h1>
          <p className="text-slate-500 mt-1">Seguí el estado de tu solicitud en tiempo real</p>
        </div>

        {!proyecto ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-[#1B2A47] mb-2">Sin proyectos aún</h2>
            <p className="text-slate-500 mb-6">Todavía no tenés proyectos asociados a esta cuenta.</p>
            <Link
              href="/cotizar"
              className="inline-flex items-center gap-2 bg-[#F05A28] text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors"
            >
              Cotizar un proyecto
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Estado card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Código de proyecto</p>
                  <p className="text-2xl font-black text-[#1B2A47] font-mono">{proyecto.codigo}</p>
                </div>
                {proyecto.estado && estadoInfo[proyecto.estado] && (
                  <span className={`text-sm font-bold px-4 py-2 rounded-full ${estadoInfo[proyecto.estado].bg} ${estadoInfo[proyecto.estado].color}`}>
                    {estadoInfo[proyecto.estado].label}
                  </span>
                )}
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Línea de fondo */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-100 -z-0" />
                <div
                  className="absolute top-5 left-5 h-0.5 bg-[#F05A28] transition-all duration-700 -z-0"
                  style={{ width: estadoIndex >= 0 ? `${(estadoIndex / (ESTADOS.length - 1)) * (100 - (10 / ESTADOS.length))}%` : '0%' }}
                />

                <div className="relative grid grid-cols-4 gap-2">
                  {ESTADOS.map((est, i) => {
                    const done = estadoIndex >= i
                    const current = estadoIndex === i
                    const info = estadoInfo[est]
                    return (
                      <div key={est} className="flex flex-col items-center text-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                          done
                            ? 'bg-[#F05A28] border-[#F05A28]'
                            : 'bg-white border-slate-200'
                        } ${current ? 'ring-4 ring-orange-100' : ''}`}>
                          {done
                            ? <CheckCircle2 className="w-5 h-5 text-white" />
                            : <Circle className="w-5 h-5 text-slate-300" />
                          }
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${done ? 'text-[#1B2A47]' : 'text-slate-400'}`}>
                            {info.label}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Estado mensaje */}
              {proyecto.estado && estadoInfo[proyecto.estado] && (
                <div className={`mt-8 p-4 rounded-xl ${estadoInfo[proyecto.estado].bg}`}>
                  <p className={`text-sm font-semibold ${estadoInfo[proyecto.estado].color}`}>
                    {estadoInfo[proyecto.estado].desc}
                  </p>
                </div>
              )}
            </div>

            {/* Presupuesto (visible sólo cuando fue enviado) */}
            {mostrarPresupuesto && resumen && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-[#F05A28]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#1B2A47]">Tu presupuesto</h2>
                      <p className="text-sm text-slate-500">Formulario R-04 · Validez 15 días</p>
                    </div>
                  </div>
                  <a
                    href={`/api/export?proyectoId=${proyecto.id}`}
                    className="inline-flex items-center gap-2 bg-[#F05A28] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </a>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Subtotal (sin IVA)</p>
                    <p className="text-xl font-black text-[#1B2A47] tabular-nums mt-1">{usd(resumen.totalSinIvaUsd)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Precio por m²</p>
                    <p className="text-xl font-black text-[#1B2A47] tabular-nums mt-1">{precioM2 > 0 ? usd(precioM2) : '—'}</p>
                  </div>
                  <div className="bg-[#1B2A47] rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-wide text-blue-200 font-semibold">Total (IVA incluido)</p>
                    <p className="text-xl font-black text-[#F05A28] tabular-nums mt-1">{usd(resumen.totalConIvaUsd)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">Valores expresados en dólares estadounidenses.</p>
                <PreaprobarOferta proyectoId={proyecto.id} estado={proyecto.estado} reunionUrl={reunionUrl} />
              </div>
            )}

            {/* Detalles del proyecto */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-lg font-bold text-[#1B2A47] mb-6">Detalles de tu solicitud</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <Field label="Cliente" value={proyecto.cliente} />
                <Field label="Fecha de solicitud" value={new Date(proyecto.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} />
                {proyecto.razon_social && <Field label="Empresa" value={proyecto.razon_social} />}
                {proyecto.ubicacion && <Field label="Ubicación de la obra" value={proyecto.ubicacion} />}
                {proyecto.datos_tecnicos?.[0] && (
                  <>
                    {proyecto.datos_tecnicos[0].tipologia && (
                      <Field label="Tipología" value={proyecto.datos_tecnicos[0].tipologia.replace(/_/g, ' ')} />
                    )}
                    {proyecto.datos_tecnicos[0].superficie && (
                      <Field label="Superficie" value={`${proyecto.datos_tecnicos[0].superficie} m²`} />
                    )}
                    {proyecto.datos_tecnicos[0].ancho && proyecto.datos_tecnicos[0].largo && (
                      <Field label="Dimensiones" value={`${proyecto.datos_tecnicos[0].ancho} m × ${proyecto.datos_tecnicos[0].largo} m`} />
                    )}
                    {proyecto.datos_tecnicos[0].altura_libre && (
                      <Field label="Altura libre" value={`${proyecto.datos_tecnicos[0].altura_libre} m`} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contacto */}
            <div className="bg-[#1B2A47] rounded-2xl p-8 text-white">
              <h2 className="text-lg font-bold mb-2">¿Tenés alguna consulta?</h2>
              <p className="text-blue-200 text-sm mb-5">
                Nuestro equipo comercial está disponible para responder tus preguntas sobre el proyecto.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:info@logmetal.com.ar"
                  className="inline-flex items-center gap-2 bg-white text-[#1B2A47] px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                  Enviar email
                </a>
                <a
                  href="https://wa.me/5492616666666"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-500 transition-colors"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className="font-semibold text-[#1B2A47] capitalize">{value}</p>
    </div>
  )
}
