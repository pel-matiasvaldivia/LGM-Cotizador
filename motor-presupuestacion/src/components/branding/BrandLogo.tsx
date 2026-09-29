import type { Brand } from '@/lib/branding'

/**
 * Logo de la marca activa. Si el tenant no cargó imagen, cae al nombre
 * comercial como wordmark tipográfico: nunca queda un hueco ni el logo de
 * otra empresa. No usa hooks, así que sirve en server y client components.
 */
export default function BrandLogo({
  brand,
  variante = 'claro',
  alto,
  className = '',
}: {
  brand: Brand
  /** 'oscuro' = sobre fondo oscuro (usa logoOscuro si existe). */
  variante?: 'claro' | 'oscuro'
  /** Alto en px; por defecto, el de la marca. */
  alto?: number
  className?: string
}) {
  const src = variante === 'oscuro' ? brand.logoOscuro || brand.logo : brand.logo
  const px = alto ?? brand.logoAlto

  if (!src) {
    return (
      <span
        className={`font-black tracking-tight leading-none ${
          variante === 'oscuro' ? 'text-white' : 'text-brand-ink'
        } ${className}`}
        style={{ fontSize: Math.round(px * 0.58) }}
      >
        {brand.nombre}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={brand.nombre}
      style={{ height: px }}
      className={`w-auto ${className}`}
    />
  )
}
