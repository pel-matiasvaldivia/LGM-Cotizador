import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col">
      <header className="bg-[#1B2A47] text-white p-4 shadow-md flex items-center justify-between">
        <Link href="/" className="font-bold text-xl flex items-center gap-2">
          <span>LogMetal</span>
        </Link>
        <nav className="flex gap-4">
          <Link href="/proyectos" className="hover:text-[#F05A28] transition-colors text-sm uppercase font-semibold tracking-wider">Proyectos</Link>
          <Link href="/proyectos/nuevo" className="hover:text-[#F05A28] transition-colors text-sm uppercase font-semibold tracking-wider">Nuevo</Link>
        </nav>
      </header>
      <main className="flex-1 w-full bg-[#F4F5F7]">
        {children}
      </main>
    </div>
  )
}
