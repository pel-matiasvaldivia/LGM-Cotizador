import Link from "next/link";
import { ArrowRight, Building2, Factory, Home, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-[#F05A28] selection:text-white flex flex-col font-sans">
      {/* HEADER / NAV */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold tracking-tighter text-[#1B2A47]">LOG</span>
            <span className="text-2xl font-extrabold tracking-tighter text-[#F05A28]">METAL</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-semibold text-slate-600">
            <a href="#servicios" className="hover:text-[#F05A28] transition-colors">Servicios</a>
            <a href="#obras" className="hover:text-[#F05A28] transition-colors">Obras</a>
            <a href="#nosotros" className="hover:text-[#F05A28] transition-colors">Nosotros</a>
          </nav>
          <Link 
            href="/cotizar" 
            className="hidden md:inline-flex items-center justify-center rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#F05A28] text-white hover:bg-[#F05A28]/90 h-10 px-4 py-2"
          >
            Cotizar Proyecto <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-[#F05A28] opacity-20 blur-[100px]"></div>
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-800 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-[#F05A28] mr-2"></span>
              Líderes en construcción industrial desde 2005
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-[#1B2A47] tracking-tight mb-8">
              Construimos el espacio <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F05A28] to-orange-400">
                para tu crecimiento
              </span>
            </h1>
            <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Solución efectiva e inteligente para grandes espacios cubiertos. Diseño, ingeniería, fabricación y montaje de naves industriales a nivel nacional.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/cotizar" 
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg text-lg font-bold transition-all bg-[#1B2A47] text-white hover:bg-[#1B2A47]/90 h-14 px-8 shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                Inicia tu Proyecto Ahora
              </Link>
              <a 
                href="#servicios" 
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg text-lg font-semibold transition-colors border-2 border-slate-200 text-slate-700 hover:bg-slate-100 h-14 px-8"
              >
                Conocer Más
              </a>
            </div>
          </div>
        </section>

        {/* SERVICES SECTION */}
        <section id="servicios" className="py-24 bg-white border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-[#1B2A47] mb-4">Nuestros Servicios</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Experiencia técnica y capacidad operativa para resolver sus necesidades de infraestructura.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Service 1 */}
              <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="w-14 h-14 rounded-xl bg-blue-50 text-[#1B2A47] flex items-center justify-center mb-6 group-hover:bg-[#1B2A47] group-hover:text-white transition-colors">
                  <Factory size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#1B2A47] mb-3">Naves Industriales</h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Sistemas constructivos Alveolar, Alma Llena y Reticulado. Económicos, estandarizados y de rápido montaje para grandes espacios sin columnas intermedias.
                </p>
                <ul className="space-y-2 mb-6">
                  {['Sistema Kit económico', 'Sin soldaduras en obra', 'Grandes luces libres'].map((item, i) => (
                    <li key={i} className="flex items-center text-sm text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-[#F05A28] mr-2" /> {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Service 2 */}
              <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="w-14 h-14 rounded-xl bg-orange-50 text-[#F05A28] flex items-center justify-center mb-6 group-hover:bg-[#F05A28] group-hover:text-white transition-colors">
                  <Building2 size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#1B2A47] mb-3">Edificios Corporativos</h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Arquitectura metálica moderna para oficinas y espacios comerciales. Diseño de vanguardia que aprovecha al máximo la geografía y sus vistas.
                </p>
              </div>

              {/* Service 3 */}
              <div className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="w-14 h-14 rounded-xl bg-blue-50 text-[#1B2A47] flex items-center justify-center mb-6 group-hover:bg-[#1B2A47] group-hover:text-white transition-colors">
                  <Home size={28} />
                </div>
                <h3 className="text-xl font-bold text-[#1B2A47] mb-3">Soluciones Modulares</h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Alternativa habitacional y comercial. Unidades transportables, de rápida implantación y bajos costos de mantenimiento.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT / STATS */}
        <section id="nosotros" className="py-24 bg-[#1B2A47] text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">Ingeniería que respalda tu inversión</h2>
                <p className="text-blue-100 text-lg leading-relaxed mb-8">
                  LOGMETAL SRL nace en 2005 como fabricante de estructuras metálicas. Hoy ofrecemos servicios integrales desde el diseño y la ingeniería, hasta la fabricación, montaje y ejecución llave en mano en toda Argentina.
                </p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-4xl font-extrabold text-[#F05A28] mb-2">+15</div>
                    <div className="text-sm font-semibold text-blue-200">Años de Trayectoria</div>
                  </div>
                  <div>
                    <div className="text-4xl font-extrabold text-[#F05A28] mb-2">100%</div>
                    <div className="text-sm font-semibold text-blue-200">Cobertura Nacional</div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-[#F05A28] rounded-2xl translate-x-4 translate-y-4"></div>
                <div className="relative bg-white rounded-2xl overflow-hidden aspect-video shadow-2xl flex items-center justify-center border-4 border-slate-800">
                  <div className="text-slate-300 font-bold text-2xl">[ Imagen Institucional ]</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PORTFOLIO LOGOS */}
        <section id="obras" className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-8">Empresas que confían en nosotros</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              <h4 className="text-2xl font-bold font-serif">WEATHERFORD</h4>
              <h4 className="text-2xl font-bold tracking-tighter">VOLKSWAGEN</h4>
              <h4 className="text-2xl font-black italic">TOYOTA</h4>
              <h4 className="text-2xl font-bold text-slate-800">BIOAGIL</h4>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="py-24 bg-gradient-to-br from-[#F05A28] to-orange-600 relative overflow-hidden">
           <div className="absolute right-0 bottom-0 w-[500px] h-[500px] bg-white opacity-10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
           <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
             <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">¿Listo para construir el futuro?</h2>
             <p className="text-xl text-orange-100 mb-10">
               Utiliza nuestro cotizador automatizado y obtén un desglose comercial preciso para tu nave industrial en minutos, impulsado por Inteligencia Artificial.
             </p>
             <Link 
                href="/cotizar" 
                className="inline-flex items-center justify-center rounded-full text-lg font-bold transition-all bg-white text-[#F05A28] hover:bg-gray-50 h-16 px-10 shadow-2xl hover:scale-105"
              >
                Cotizar Mi Proyecto <ChevronRight className="ml-2 w-6 h-6" />
              </Link>
           </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#0f172a] py-12 border-t border-slate-800 text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tighter text-white">LOG</span>
            <span className="text-xl font-extrabold tracking-tighter text-[#F05A28]">METAL</span>
          </div>
          <div className="text-sm">
            © {new Date().getFullYear()} Log Metal SRL. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
