'use client'

import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'

// Botón para copiar el link del formulario público de requerimientos que el
// comercial le pasa al cliente (/solicitud).
export default function CompartirFormulario() {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    const url = `${window.location.origin}/solicitud`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback si el navegador bloquea el portapapeles
      window.prompt('Copiá el link del formulario:', url)
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      onClick={copiar}
      title="Copiar el link del formulario para enviárselo al cliente"
      className="flex items-center gap-2 bg-white text-[#1B2A47] border border-gray-200 px-4 py-2.5 rounded-xl font-semibold hover:border-[#1B2A47] transition-all"
    >
      {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
      {copiado ? 'Link copiado' : 'Formulario para el cliente'}
    </button>
  )
}
