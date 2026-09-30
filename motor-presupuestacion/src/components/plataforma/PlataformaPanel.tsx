'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, Building2, Check, Globe, Loader2, Plus, Power, Sprout, Trash2, UserPlus, X,
} from 'lucide-react'

// Panel de plataforma: las empresas del servicio. Lo que se hace acá es lo que
// una empresa NO puede hacerse a sí misma —existir, tener dominios, tener su
// primer admin—; el resto de su configuración la maneja su propio admin.

export type Empresa = {
  id: string
  slug: string
  nombre: string
  razonSocial: string
  cuit: string
  activo: boolean
  tieneLogo: boolean
  colorPrimario: string
  dominios: string[]
  usuarios: number
  proyectos: number
  rubros: number
  creada: string
}

const input =
  'block w-full rounded-lg border border-gray-200 bg-white p-2.5 text-brand-ink focus:ring-2 focus:ring-brand focus:border-transparent outline-none text-sm'

function Metrica({ valor, label }: { valor: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-brand-ink leading-none">{valor}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function PlataformaPanel({
  empresas,
  tenantPropioId,
  dominioActual,
}: {
  empresas: Empresa[]
  tenantPropioId: string | null
  /** Dominio por el que se está navegando ahora mismo. */
  dominioActual: string
}) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const empresaPropia = empresas.find((e) => e.id === tenantPropioId)
  // La empresa por la que estoy entrando no tiene dominio propio: es la que se
  // rompe al crear la segunda.
  const faltaDominioPropio = Boolean(empresaPropia && empresaPropia.dominios.length === 0)

  // Formularios abiertos: alta de empresa y, por empresa, dominio / admin / borrado.
  const [alta, setAlta] = useState(false)
  const [nueva, setNueva] = useState({
    slug: '', nombre: '', dominios: '', adminEmail: '', adminPassword: '', adminNombre: '',
  })
  const [panel, setPanel] = useState<{ id: string; tipo: 'dominio' | 'admin' | 'borrar' } | null>(null)
  const [dominio, setDominio] = useState('')
  const [admin, setAdmin] = useState({ email: '', password: '', nombre: '' })
  const [confirmar, setConfirmar] = useState('')

  // Toda acción pasa por acá: un único lugar donde se maneja el estado de
  // ocupado, el error y el refresco de la lista.
  async function accion(clave: string, fn: () => Promise<Response>, exito?: string) {
    setOcupado(clave)
    setError(null)
    setMsg(null)
    try {
      const res = await fn()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'La operación falló')
      const detalle: string | undefined = Array.isArray(data.pasos)
        ? data.pasos.join(' · ')
        : data.aviso || data.mensaje
      setMsg([exito, detalle].filter(Boolean).join(' — ') || 'Listo')
      router.refresh()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La operación falló')
      return false
    } finally {
      setOcupado(null)
    }
  }

  const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  async function crearEmpresa() {
    const ok = await accion('alta', () => fetch('/api/admin/tenants', json(nueva)))
    if (ok) {
      setAlta(false)
      setNueva({ slug: '', nombre: '', dominios: '', adminEmail: '', adminPassword: '', adminNombre: '' })
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-brand-ink mb-1">Plataforma</h1>
          <p className="text-slate-500 text-sm">
            Empresas que usan el servicio. Cada una entra por su dominio y administra sus propios
            datos, usuarios y catálogo.
          </p>
        </div>
        {!alta && (
          <button onClick={() => setAlta(true)}
                  className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-hover shrink-0">
            <Plus className="w-4 h-4" /> Nueva empresa
          </button>
        )}
      </div>

      {msg && <div className="text-sm rounded-lg px-4 py-2.5 bg-emerald-50 text-emerald-700 mb-4">{msg}</div>}
      {error && <div className="text-sm rounded-lg px-4 py-2.5 bg-red-50 text-red-700 mb-4">{error}</div>}

      {/* Mientras hay una sola empresa, el sitio responde por cualquier dominio
          y nadie se entera de que falta asignarlo. En cuanto aparece la
          segunda, ese atajo se termina y el sitio actual deja de resolver: hay
          que avisarlo ANTES de que pase, no después. */}
      {faltaDominioPropio && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-amber-900 mb-1">
                Falta asignarle su dominio a {empresaPropia?.nombre}
              </p>
              <p className="text-sm text-amber-800/90 mb-3">
                Hoy funciona igual porque es la única empresa: sin dominios asignados, el sitio
                responde en cualquiera. Pero apenas des de alta una segunda,{' '}
                <strong>{dominioActual || 'este dominio'}</strong> deja de resolver y el sitio se cae
                hasta que se lo asignes.
              </p>
              {dominioActual && (
                <button
                  disabled={ocupado === 'dominio-propio'}
                  onClick={() => accion('dominio-propio',
                    () => fetch(`/api/admin/tenants/${empresaPropia!.id}/dominios`, json({ dominio: dominioActual })),
                    `${dominioActual} asignado a ${empresaPropia!.nombre}`)}
                  className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-amber-700 disabled:opacity-40"
                >
                  {ocupado === 'dominio-propio'
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Globe className="w-4 h-4" />}
                  Asignar {dominioActual}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Alta de empresa ─────────────────────────────────── */}
      {alta && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-brand-ink">Nueva empresa</h2>
            <button onClick={() => setAlta(false)} className="text-slate-400 hover:text-brand-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Se crea la empresa, se le asignan los dominios, se le copia un catálogo de arranque y se
            le crea su admin. Después ese admin completa CUIT, domicilio, logo y colores desde
            Configuración → Empresa.
          </p>

          {faltaDominioPropio && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <strong>Antes de seguir:</strong> {empresaPropia?.nombre} todavía no tiene dominio
              asignado. Si creás esta empresa primero, {dominioActual || 'el sitio actual'} deja de
              resolver.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Identificador</label>
              <input className={input} value={nueva.slug} placeholder="acero-sur"
                     onChange={(e) => setNueva({ ...nueva, slug: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">Minúsculas, números y guiones. No se muestra al cliente.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
              <input className={input} value={nueva.nombre} placeholder="Acero Sur"
                     onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Dominios</label>
              <input className={input} value={nueva.dominios} placeholder="acerosur.com, presupuestos.acerosur.com"
                     onChange={(e) => setNueva({ ...nueva, dominios: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">
                Separados por coma. Tienen que apuntar por DNS a este servidor.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Email del admin</label>
              <input className={input} type="email" value={nueva.adminEmail} placeholder="admin@acerosur.com"
                     onChange={(e) => setNueva({ ...nueva, adminEmail: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Contraseña inicial</label>
              <input className={input} value={nueva.adminPassword} placeholder="mínimo 8 caracteres"
                     onChange={(e) => setNueva({ ...nueva, adminPassword: e.target.value })} />
            </div>
          </div>

          <button onClick={crearEmpresa} disabled={ocupado === 'alta'}
                  className="mt-5 inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-hover disabled:opacity-40">
            {ocupado === 'alta' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Crear empresa
          </button>
        </section>
      )}

      {/* ── Empresas ────────────────────────────────────────── */}
      <div className="space-y-4">
        {empresas.map((e) => {
          const propia = e.id === tenantPropioId
          const abierto = panel?.id === e.id ? panel.tipo : null

          return (
            <section key={e.id}
                     className={`bg-white rounded-2xl border shadow-sm p-5 ${e.activo ? 'border-gray-100' : 'border-amber-200 bg-amber-50/30'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                       style={{ background: e.colorPrimario || 'var(--brand-ink)' }}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-brand-ink truncate">{e.nombre}</h2>
                      <code className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{e.slug}</code>
                      {propia && (
                        <span className="text-[11px] font-bold uppercase tracking-wide text-brand">esta sesión</span>
                      )}
                      {!e.activo && (
                        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700">desactivada</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.razonSocial || 'sin razón social'}{e.cuit ? ` · CUIT ${e.cuit}` : ' · sin CUIT'}
                      {e.tieneLogo ? ' · logo cargado' : ' · sin logo'}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {e.dominios.length === 0 && (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          sin dominio asignado
                        </span>
                      )}
                      {e.dominios.map((d) => (
                        <span key={d} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 rounded-full pl-2 pr-1 py-0.5">
                          <Globe className="w-3 h-3" />{d}
                          <button
                            title="Quitar dominio"
                            className="text-slate-400 hover:text-red-600 px-0.5"
                            disabled={ocupado === `dom-${d}`}
                            onClick={() => accion(`dom-${d}`,
                              () => fetch(`/api/admin/tenants/${e.id}/dominios?dominio=${encodeURIComponent(d)}`, { method: 'DELETE' }),
                              `${d} desasignado`)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <Metrica valor={e.usuarios} label="usuarios" />
                  <Metrica valor={e.proyectos} label="proyectos" />
                  <Metrica valor={e.rubros} label="rubros" />
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => { setPanel(abierto === 'dominio' ? null : { id: e.id, tipo: 'dominio' }); setDominio('') }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand">
                  <Globe className="w-4 h-4" /> Dominio
                </button>
                <button onClick={() => { setPanel(abierto === 'admin' ? null : { id: e.id, tipo: 'admin' }); setAdmin({ email: '', password: '', nombre: '' }) }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand">
                  <UserPlus className="w-4 h-4" /> Crear admin
                </button>
                <button disabled={ocupado === `semilla-${e.id}`}
                        onClick={() => accion(`semilla-${e.id}`,
                          () => fetch(`/api/admin/tenants/${e.id}/semilla`, json({})), 'Semilla aplicada')}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand disabled:opacity-40">
                  {ocupado === `semilla-${e.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4" />}
                  Sembrar catálogo
                </button>
                <button disabled={ocupado === `activo-${e.id}`}
                        onClick={() => accion(`activo-${e.id}`,
                          () => fetch(`/api/admin/tenants/${e.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ activo: !e.activo }),
                          }),
                          e.activo ? `"${e.slug}" desactivada` : `"${e.slug}" activada`)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand disabled:opacity-40">
                  <Power className="w-4 h-4" /> {e.activo ? 'Desactivar' : 'Activar'}
                </button>
                {!propia && (
                  <button onClick={() => { setPanel(abierto === 'borrar' ? null : { id: e.id, tipo: 'borrar' }); setConfirmar('') }}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-red-600 ml-auto">
                    <Trash2 className="w-4 h-4" /> Borrar
                  </button>
                )}
              </div>

              {abierto === 'dominio' && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Nuevo dominio</label>
                  <div className="flex gap-2">
                    <input className={input} value={dominio} placeholder="acerosur.com"
                           onChange={(ev) => setDominio(ev.target.value)} />
                    <button disabled={!dominio || ocupado === `add-${e.id}`}
                            onClick={async () => {
                              const ok = await accion(`add-${e.id}`,
                                () => fetch(`/api/admin/tenants/${e.id}/dominios`, json({ dominio })),
                                'Dominio asignado')
                              if (ok) { setDominio(''); setPanel(null) }
                            }}
                            className="bg-brand text-white px-4 rounded-lg font-bold text-sm hover:bg-brand-hover disabled:opacity-40 shrink-0">
                      Asignar
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Se guarda sin `www.` ni puerto. Si ya estaba en otra empresa, se mueve y se avisa.
                  </p>
                </div>
              )}

              {abierto === 'admin' && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-3">
                    Un admin de <strong>{e.nombre}</strong>. Entra por el dominio de esa empresa, no por este.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className={input} type="email" placeholder="admin@empresa.com" value={admin.email}
                           onChange={(ev) => setAdmin({ ...admin, email: ev.target.value })} />
                    <input className={input} placeholder="contraseña (8+)" value={admin.password}
                           onChange={(ev) => setAdmin({ ...admin, password: ev.target.value })} />
                    <input className={input} placeholder="nombre (opcional)" value={admin.nombre}
                           onChange={(ev) => setAdmin({ ...admin, nombre: ev.target.value })} />
                  </div>
                  <button disabled={ocupado === `adm-${e.id}`}
                          onClick={async () => {
                            const ok = await accion(`adm-${e.id}`,
                              () => fetch(`/api/admin/tenants/${e.id}/usuarios`, json(admin)),
                              `Admin creado en "${e.slug}"`)
                            if (ok) setPanel(null)
                          }}
                          className="mt-3 bg-brand text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-hover disabled:opacity-40">
                    Crear admin
                  </button>
                </div>
              )}

              {abierto === 'borrar' && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-4">
                  <p className="text-sm text-red-700 font-semibold mb-1">
                    Borrar “{e.nombre}” elimina todo lo suyo
                  </p>
                  <p className="text-xs text-red-600/90 mb-3">
                    {e.usuarios} usuario(s), {e.proyectos} proyecto(s), su catálogo, sus precios y su
                    configuración. No hay vuelta atrás. Para confirmar, escribí <code>{e.slug}</code>.
                  </p>
                  <div className="flex gap-2">
                    <input className={input} value={confirmar} placeholder={e.slug}
                           onChange={(ev) => setConfirmar(ev.target.value)} />
                    <button disabled={confirmar !== e.slug || ocupado === `del-${e.id}`}
                            onClick={async () => {
                              const ok = await accion(`del-${e.id}`,
                                () => fetch(`/api/admin/tenants/${e.id}?confirmar=${encodeURIComponent(confirmar)}`, { method: 'DELETE' }),
                                `"${e.slug}" borrada`)
                              if (ok) setPanel(null)
                            }}
                            className="bg-red-600 text-white px-4 rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-40 shrink-0">
                      Borrar
                    </button>
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Los mismos comandos existen por consola (<code>scripts/tenant.mjs</code>) para cuando el panel
        no está disponible.
      </p>
    </div>
  )
}
