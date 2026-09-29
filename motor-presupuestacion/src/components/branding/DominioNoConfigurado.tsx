// Pantalla para un dominio que no está asignado a ninguna empresa. Es una
// situación de configuración (un host apuntado al servidor antes de darlo de
// alta), no un error del visitante: por eso no muestra ninguna marca ni finge
// ser el sitio de una empresa genérica.
export default function DominioNoConfigurado({ dominio }: { dominio?: string }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Dominio no configurado
        </p>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          Este dominio todavía no está asignado
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          {dominio ? <><strong>{dominio}</strong> no corresponde</> : 'Este dominio no corresponde'} a
          ninguna empresa del servicio. Si estás configurando el sitio, falta asignarlo desde la
          administración de la plataforma.
        </p>
      </div>
    </main>
  )
}
