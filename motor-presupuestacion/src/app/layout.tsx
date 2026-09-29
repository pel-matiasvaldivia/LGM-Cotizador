import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import BrandStyle from "@/components/branding/BrandStyle";
import { getBrandActual } from "@/lib/tenant";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-sans",
  display: "swap",
});

// Título y descripción los define la empresa dueña del dominio. Resolverla lee
// el Host, y eso ya hace que cada ruta se renderice en runtime: la imagen de
// Docker es común a todos los tenants, así que nada puede quedar horneado en el
// build.
export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getBrandActual();
  return { title: meta.title, description: meta.description };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brand = await getBrandActual();

  return (
    <html lang="es" className={`${notoSans.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col font-[family-name:var(--font-noto-sans)]`}>
        {/* Paleta de la marca: alimenta todas las utilidades *-brand* */}
        <BrandStyle brand={brand} />
        {children}
      </body>
    </html>
  );
}
