import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Log Metal SRL — Estructuras Metálicas Industriales",
  description: "Diseño, ingeniería, fabricación y montaje de naves industriales. Cotizá tu proyecto en minutos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${notoSans.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col font-[family-name:var(--font-noto-sans)]`}>
        {children}
      </body>
    </html>
  );
}
