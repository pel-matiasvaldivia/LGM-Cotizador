'use client'

import { useState } from 'react'
import { Users, Plus, Pencil, Trash2, KeyRound, X, Loader2, Shield } from 'lucide-react'

type Usuario = {
  id: string
  email: string
  nombre: string
  rol: 'admin' | 'comercial' | 'cliente'
  created_at: string
}

const ROLES: Usuario['rol'][] = ['admin', 'comercial', 'cliente']
const rolLabel: Record<Usuario['rol'], string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
  cliente: 'Cliente',
}
const rolColor: Record<Usuario['rol'], string> = {
  admin: 'bg-violet-100 text-violet-700',
  comercial: 'bg-blue-100 text-blue-700',
  cliente: 'bg-slate-100 text-slate-600',
}

const FORM_VACIO = { email: '', nombre: '', rol: 'comercial' as Usuario['rol'], password: '' }

export default function GestionUsuarios({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // null = creando; string = editando ese id
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VACIO)

  const abrir = async () => {
    setOpen(true)
    resetForm()
    await cargar()
  }

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar')
      setUsuarios(data.usuarios)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditId(null)
    setForm(FORM_VACIO)
    setError(null)
  }

  const editar = (u: Usuario) => {
    setEditId(u.id)
    setForm({ email: u.email, nombre: u.nombre, rol: u.rol, password: '' })
    setError(null)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const url = editId ? `/api/usuarios/${editId}` : '/api/usuarios'
      const method = editId ? 'PATCH' : 'POST'
      // En edición, la contraseña vacía significa "no cambiar"
      const payload: any = { email: form.email, nombre: form.nombre, rol: form.rol }
      if (form.password) payload.password = form.password
      if (!editId && !form.password) throw new Error('La contraseña es obligatoria')

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      resetForm()
      await cargar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const blanquear = async (u: Usuario) => {
    const nueva = window.prompt(`Nueva contraseña para ${u.email} (mínimo 6 caracteres):`)
    if (nueva === null) return
    if (nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nueva }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al blanquear')
      window.alert(`Contraseña actualizada para ${u.email}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const eliminar = async (u: Usuario) => {
    if (!window.confirm(`¿Eliminar a ${u.email}? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      if (editId === u.id) resetForm()
      await cargar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        className="hover:text-[#F05A28] transition-colors text-sm uppercase font-semibold tracking-wider flex items-center gap-1.5"
      >
        <Users className="w-4 h-4" />
        Usuarios
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-[#1B2A47]">
                <Shield className="w-5 h-5" />
                <h2 className="font-bold text-lg">Gestión de usuarios</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 border border-red-100">{error}</div>
              )}

              {/* Formulario alta / edición */}
              <form onSubmit={guardar} className="bg-[#F4F5F7] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-[#1B2A47] font-semibold text-sm">
                  {editId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editId ? 'Editar usuario' : 'Nuevo usuario'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    required
                    placeholder="email@empresa.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value as Usuario['rol'] })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {rolLabel[r]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder={editId ? 'Contraseña (vacío = sin cambio)' : 'Contraseña (mín. 6)'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="bg-[#F05A28] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-orange-600 disabled:opacity-40 flex items-center gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {editId ? 'Guardar cambios' : 'Crear usuario'}
                  </button>
                  {editId && (
                    <button type="button" onClick={resetForm} className="text-slate-500 text-sm hover:text-slate-800 px-2">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              {/* Listado */}
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-gray-100">
                        <th className="py-2 pr-3 font-semibold">Usuario</th>
                        <th className="py-2 px-3 font-semibold">Rol</th>
                        <th className="py-2 pl-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u) => (
                        <tr key={u.id} className="border-b border-gray-50 hover:bg-slate-50/60">
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold text-[#1B2A47]">{u.nombre || '—'}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${rolColor[u.rol]}`}>
                              {rolLabel[u.rol]}
                            </span>
                          </td>
                          <td className="py-2.5 pl-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => editar(u)}
                                title="Editar"
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1B2A47]"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => blanquear(u)}
                                title="Blanquear contraseña"
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => eliminar(u)}
                                disabled={u.id === currentUserId}
                                title={u.id === currentUserId ? 'No podés eliminar tu propia cuenta' : 'Eliminar'}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {usuarios.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-400">
                            No hay usuarios
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
