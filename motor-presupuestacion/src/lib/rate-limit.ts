// Límite de uso para las rutas públicas (las que no piden login). Sin esto,
// cualquiera con la URL puede crear proyectos en masa, probar contraseñas o
// —lo más caro— disparar llamadas a la IA hasta agotar el presupuesto.
//
// Es un contador en memoria del proceso: alcanza para un despliegue de un
// contenedor, que es el caso de hoy. Si algún día corren varias réplicas, el
// límite efectivo se multiplica por la cantidad de réplicas y hay que mover el
// contador a Postgres o Redis.

import { AuthError } from '@/lib/errors'

interface Ventana {
  /** Momentos de los intentos dentro de la ventana, en ms. */
  golpes: number[]
  /** Último uso, para poder limpiar las claves abandonadas. */
  visto: number
}

const contadores = new Map<string, Ventana>()
const LIMPIEZA_CADA_MS = 10 * 60 * 1000
let ultimaLimpieza = Date.now()

// El Map no puede crecer para siempre: cada tanto se tiran las claves que ya no
// tienen golpes vigentes.
function limpiar(ahora: number, ventanaMaxMs: number) {
  if (ahora - ultimaLimpieza < LIMPIEZA_CADA_MS) return
  ultimaLimpieza = ahora
  for (const [clave, v] of contadores) {
    if (ahora - v.visto > ventanaMaxMs) contadores.delete(clave)
  }
}

export interface Limite {
  /** Intentos permitidos dentro de la ventana. */
  max: number
  ventanaMs: number
}

export interface ResultadoLimite {
  ok: boolean
  restantes: number
  /** Segundos hasta que se libere un lugar (para el header Retry-After). */
  reintentarEn: number
}

/** Registra un intento y dice si está dentro del límite. */
export function limitar(clave: string, { max, ventanaMs }: Limite): ResultadoLimite {
  const ahora = Date.now()
  limpiar(ahora, ventanaMs)

  const actual = contadores.get(clave) ?? { golpes: [], visto: ahora }
  const golpes = actual.golpes.filter((t) => ahora - t < ventanaMs)

  if (golpes.length >= max) {
    contadores.set(clave, { golpes, visto: ahora })
    const masViejo = golpes[0]
    return {
      ok: false,
      restantes: 0,
      reintentarEn: Math.max(1, Math.ceil((ventanaMs - (ahora - masViejo)) / 1000)),
    }
  }

  golpes.push(ahora)
  contadores.set(clave, { golpes, visto: ahora })
  return { ok: true, restantes: max - golpes.length, reintentarEn: 0 }
}

/** Solo para tests: vacía los contadores. */
export function resetLimites(): void {
  contadores.clear()
  ultimaLimpieza = Date.now()
}

export class LimiteExcedido extends AuthError {
  reintentarEn: number
  constructor(reintentarEn: number) {
    super('Demasiados intentos. Probá de nuevo en un rato.', 429)
    this.reintentarEn = reintentarEn
  }
}

/**
 * IP del visitante. Detrás del reverse proxy el socket es el del proxy, así que
 * vale el primer valor de X-Forwarded-For (el que agregó el proxy más externo).
 */
export function ipDelRequest(req: Request): string {
  const h = req.headers
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip')?.trim() || 'desconocida'
}

/** Aplica un límite por IP de origen y corta con 429 si se pasó. */
export function exigirLimite(req: Request, nombre: string, limite: Limite): void {
  aplicar(`${nombre}:${ipDelRequest(req)}`, limite)
}

/**
 * Aplica un límite por algo del pedido —la cuenta, en el login— SIN mirar la
 * IP. Es a propósito: si la clave incluyera la IP, rotar IPs alcanzaría para
 * probar contraseñas de la misma cuenta sin tope, que es justo lo que este
 * límite tiene que frenar. El tope por IP va aparte, con exigirLimite().
 */
export function exigirLimitePorClave(nombre: string, limite: Limite, clave: string): void {
  aplicar(`${nombre}:${clave.trim().toLowerCase()}`, limite)
}

function aplicar(clave: string, limite: Limite): void {
  const r = limitar(clave, limite)
  if (!r.ok) throw new LimiteExcedido(r.reintentarEn)
}

/** Límites por ruta, juntos para poder revisarlos de una mirada. */
export const LIMITES = {
  // Precio en vivo del wizard: se llama a cada paso, tiene que ser holgado.
  estimacion: { max: 60, ventanaMs: 60_000 },
  // Lectura de planos con IA: es la llamada que cuesta plata de verdad.
  vision: { max: 10, ventanaMs: 60 * 60_000 },
  // Formulario público de requerimientos: crea proyecto y guarda adjuntos.
  solicitud: { max: 5, ventanaMs: 60 * 60_000 },
  // Login: freno de fuerza bruta, por IP y por cuenta.
  login: { max: 10, ventanaMs: 5 * 60_000 },
  loginPorCuenta: { max: 10, ventanaMs: 15 * 60_000 },
  // Alta de cuentas del portal.
  registro: { max: 5, ventanaMs: 60 * 60_000 },
  // Reenvío del mail de verificación.
  verificacion: { max: 5, ventanaMs: 60 * 60_000 },
} as const
