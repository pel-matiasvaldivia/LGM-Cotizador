'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

export default function LogoutButton({ redirectTo = '/login' }: { redirectTo?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#F05A28] transition-colors disabled:opacity-50"
      title="Cerrar sesión"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">Salir</span>
    </button>
  )
}
