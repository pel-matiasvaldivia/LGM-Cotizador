import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import BrandStyle from "@/components/branding/BrandStyle";
import { getBrand } from "@/lib/branding";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-sans",
  display: "swap",
});

// La imagen de Docker es la misma para todos los tenants: la marca se resuelve
// en el arranque, desde el entorno del despliegue. Por eso nada puede quedar
// prerenderizado en el build, o el logo y la paleta serían los del build y no
// los de la empresa que contrató el servicio.
export const dynamic = 'force-dynamic'

// Título y descripción los define la marca contratada (config/brands/*.json).
export function generateMetadata(): Metadata {
  const { meta } = getBrand();
  return { title: meta.title, description: meta.description };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${notoSans.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col font-[family-name:var(--font-noto-sans)]`}>
        {/* Paleta de la marca: alimenta todas las utilidades *-brand* */}
        <BrandStyle brand={getBrand()} />
        {children}
      </body>
    </html>
  );
}
