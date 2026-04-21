'use client'

import { useState } from 'react'

export default function SeedPage() {
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSeed = async () => {
    setLoading(true)
    const res = await fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'logmetal-seed-2026' }),
    })
    const data = await res.json()
    setResultado(data)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100">
        <h1 className="text-xl font-bold text-[#1B2A47] mb-2">Crear usuarios de prueba</h1>
        <p className="text-slate-500 text-sm mb-6">
          Esto crea los usuarios iniciales en Supabase Auth. Solo necesitás ejecutarlo una vez.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm font-mono">
          <p className="text-slate-600">comercial@logmetal.com</p>
          <p className="text-slate-600">admin@logmetal.com</p>
          <p className="text-slate-400 mt-1">Contraseña: <span className="text-[#1B2A47] font-semibold">LogMetal2026!</span></p>
        </div>

        <button
          onClick={handleSeed}
          disabled={loading}
          className="w-full bg-[#F05A28] text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-40"
        >
          {loading ? 'Creando usuarios...' : 'Crear usuarios'}
        </button>

        {resultado && (
          <div className="mt-4 bg-slate-50 rounded-xl p-4 text-sm">
            {resultado.resultados?.map((r: any) => (
              <div key={r.email} className="flex justify-between py-1">
                <span className="text-slate-600">{r.email}</span>
                <span className={r.status === 'error' ? 'text-red-500' : 'text-green-600 font-semibold'}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
