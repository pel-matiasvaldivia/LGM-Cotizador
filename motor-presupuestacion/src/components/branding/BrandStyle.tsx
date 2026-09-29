import { brandCssVars, type Brand } from '@/lib/branding'

/**
 * Inyecta la paleta de la marca activa como variables CSS en `:root`.
 * Va una sola vez en el layout raíz: a partir de ahí todas las utilidades
 * `*-brand*` de Tailwind (ver globals.css) toman los colores del tenant.
 *
 * Los valores están saneados a hex en `getBrand()`, así que no pueden escapar
 * de la declaración CSS.
 */
export default function BrandStyle({ brand }: { brand: Brand }) {
  // `href` + `precedence` hacen que React lo ice al <head> y lo deduplique,
  // después de globals.css (que define los defaults y las derivadas).
  return (
    <style
      href={`brand-${brand.slug}`}
      precedence="high"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: `:root{${brandCssVars(brand)}}` }}
    />
  )
}
