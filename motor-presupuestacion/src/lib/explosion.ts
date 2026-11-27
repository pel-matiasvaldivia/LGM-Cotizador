// Explosión de materiales: la lista de materiales sale de la cotización.
//
// La plataforma sabe la geometría desde que el cliente cotiza: luz, largo,
// altura libre, superficie, tipología, qué incluye. Lo que no sabe por sí sola
// es cuántos kilos de cada perfil lleva eso. Ese dato está en las obras ya
// hechas, y es de ahí que se saca.
//
// CÓMO: se elige la obra de referencia más parecida y se escala su despiece.
// Cada renglón escala sobre su propia base —la estructura por m² de planta, el
// cierre lateral por m² de lateral, la escalera no escala— así que una nave
// más alta lleva más cierre sin llevar más cubierta.
//
// POR QUÉ NO SE PROMEDIAN VARIAS OBRAS: promediar mezcla juegos de perfiles
// distintos y da un despiece que nunca existió, con medio W410 y medio W360 en
// la misma viga. Oficina técnica estima tomando la obra más parecida que ya
// hizo; el motor hace lo mismo y dice cuál usó.
//
// LO QUE DEVUELVE ES UNA PROPUESTA. Oficina técnica la revisa y la corrige, y
// esa corrección pasa a ser la referencia de la próxima.

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  datosTecnicos, obrasReferencia, obrasReferenciaItems,
  type BaseEscala, type DatosTecnicosRow, type ObraReferencia, type ObraReferenciaItem,
} from '@/db/schema'
import { AuthError } from '@/lib/errors'

/* ─── Geometría ───────────────────────────────────────────────── */

export interface Geometria {
  tipologia: string
  ancho: number
  largo: number
  alturaLibre: number
  superficie: number
  cantidadPortones: number
}

export function geometriaDe(dt: DatosTecnicosRow | null | undefined): Geometria {
  const ancho = Number(dt?.ancho) || 0
  const largo = Number(dt?.largo) || 0
  return {
    tipologia: (dt?.tipologia ?? '').toUpperCase(),
    ancho,
    largo,
    alturaLibre: Number(dt?.alturaLibre) || 0,
    superficie: Number(dt?.superficie) || ancho * largo,
    cantidadPortones: Number(dt?.cantidadPortones) || 0,
  }
}

export function geometriaDeObra(o: ObraReferencia): Geometria {
  return {
    tipologia: (o.tipologia ?? '').toUpperCase(),
    ancho: o.ancho,
    largo: o.largo,
    alturaLibre: o.alturaLibre,
    superficie: o.superficie,
    cantidadPortones: 0,
  }
}

/** El valor de cada base para una geometría dada. */
export function medidaBase(base: BaseEscala, g: Geometria): number {
  switch (base) {
    case 'm2_cubierta':
      return g.superficie
    case 'm2_lateral':
      // Perímetro por altura libre: es la superficie que hay que cerrar.
      return 2 * (g.ancho + g.largo) * g.alturaLibre
    case 'ml_perimetro':
      return 2 * (g.ancho + g.largo)
    case 'unidad_porton':
      return g.cantidadPortones
    case 'global':
      return 1
  }
}

/**
 * Qué base le corresponde a un subconjunto, por su nombre. Es la suposición
 * inicial al guardar una obra de referencia; después se puede corregir
 * renglón por renglón.
 */
export function baseSugerida(subconjunto: string): BaseEscala {
  const s = subconjunto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/(cierre|cerramiento)\s+lateral|tensores? laterales?|lateral/.test(s)) return 'm2_lateral'
  if (/zingueria|canaleta|cenefa|babeta|veredin|vereda/.test(s)) return 'ml_perimetro'
  if (/porton/.test(s)) return 'unidad_porton'
  // Una escalera, un portón de servicio o un tablero no crecen con los metros.
  if (/escalera|insertos?|rejas?|baranda/.test(s)) return 'global'
  return 'm2_cubierta'
}

/* ─── Elegir la obra de referencia ────────────────────────────── */

export interface Parecido {
  obra: ObraReferencia
  /** 0 = idéntica. Cuanto más bajo, más parecida. */
  distancia: number
  motivos: string[]
}

/**
 * Qué tan parecida es una obra a la que se quiere cotizar. Pesa primero lo que
 * más cambia el juego de perfiles —la luz— y después la altura; la superficie
 * casi no pesa, porque es justamente lo que después se escala.
 */
export function comparar(g: Geometria, obra: ObraReferencia): Parecido {
  const o = geometriaDeObra(obra)
  const motivos: string[] = []
  let distancia = 0

  if (g.tipologia && o.tipologia && g.tipologia !== o.tipologia) {
    distancia += 100
    motivos.push(`otra tipología (${o.tipologia})`)
  }

  const rel = (a: number, b: number) => (a > 0 && b > 0 ? Math.abs(a - b) / Math.max(a, b) : 0)

  const dLuz = rel(g.ancho, o.ancho)
  distancia += dLuz * 60
  if (dLuz > 0.15) motivos.push(`luz ${o.ancho} m contra ${g.ancho} m`)

  const dAlt = rel(g.alturaLibre, o.alturaLibre)
  distancia += dAlt * 25
  if (dAlt > 0.2) motivos.push(`altura ${o.alturaLibre} m contra ${g.alturaLibre} m`)

  const dSup = rel(g.superficie, o.superficie)
  distancia += dSup * 8
  if (dSup > 0.5) motivos.push(`${Math.round(o.superficie)} m² contra ${Math.round(g.superficie)} m²`)

  return { obra, distancia, motivos }
}

export async function obrasDelTenant(tenantId: string): Promise<ObraReferencia[]> {
  return db.query.obrasReferencia.findMany({
    where: and(eq(obrasReferencia.tenantId, tenantId), eq(obrasReferencia.activa, true)),
    orderBy: asc(obrasReferencia.createdAt),
  })
}

/* ─── Explosión ───────────────────────────────────────────────── */

export interface LineaExplotada {
  subconjunto: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  base: BaseEscala
  /** Lo que llevaba la obra de referencia, para poder comparar. */
  cantidadOrigen: number
  factor: number
}

export interface Explosion {
  obra: ObraReferencia
  geometria: Geometria
  lineas: LineaExplotada[]
  /** Factor aplicado por cada base: lo que explica cada cantidad. */
  factores: Partial<Record<BaseEscala, number>>
  parecido: Parecido
  advertencias: string[]
}

const MIN_BASE = 0.0001

/** Escala el despiece de una obra de referencia a la geometría pedida. */
export function escalar(
  obra: ObraReferencia,
  items: ObraReferenciaItem[],
  g: Geometria,
): Explosion {
  const parecido = comparar(g, obra)
  const advertencias: string[] = []
  const factores: Partial<Record<BaseEscala, number>> = {}
  const gObra = geometriaDeObra(obra)

  const factorDe = (base: BaseEscala): number => {
    if (base === 'global') return 1
    const origen = medidaBase(base, gObra)
    const destino = medidaBase(base, g)
    if (origen < MIN_BASE) return 0
    return destino / origen
  }

  const lineas: LineaExplotada[] = []
  for (const item of items) {
    const factor = factorDe(item.base)
    factores[item.base] = factor
    if (factor === 0) {
      advertencias.push(
        `"${item.descripcion}" escala por ${NOMBRE_BASE[item.base]}, y la obra de referencia no tiene esa medida cargada: queda en cero.`,
      )
    }
    lineas.push({
      subconjunto: item.subconjunto,
      codigo: item.codigo,
      descripcion: item.descripcion,
      unidad: item.unidad,
      // Dos decimales: más precisión que esa es falsa, viene de un escalado.
      cantidad: Math.round(item.cantidad * factor * 100) / 100,
      base: item.base,
      cantidadOrigen: item.cantidad,
      factor,
    })
  }

  if (!g.alturaLibre || !gObra.alturaLibre) {
    advertencias.push('Sin altura libre no se puede escalar el cierre lateral por superficie real.')
  }
  if (parecido.distancia >= 100) {
    advertencias.push(
      'La obra de referencia es de otra tipología: el juego de perfiles puede no corresponder.',
    )
  }

  return { obra, geometria: g, lineas, factores, parecido, advertencias }
}

export const NOMBRE_BASE: Record<BaseEscala, string> = {
  m2_cubierta: 'm² de planta',
  m2_lateral: 'm² de cierre lateral',
  ml_perimetro: 'metros de perímetro',
  unidad_porton: 'cantidad de portones',
  global: 'cantidad fija',
}

/**
 * Propone el despiece de un proyecto a partir de sus datos técnicos y de las
 * obras de referencia del tenant.
 */
export async function proponerDespiece(
  tenantId: string,
  proyectoId: string,
  obraElegidaId?: string,
): Promise<Explosion> {
  const dt = await db.query.datosTecnicos.findFirst({
    where: eq(datosTecnicos.proyectoId, proyectoId),
  })
  const g = geometriaDe(dt)
  if (!g.superficie) {
    throw new AuthError('El proyecto no tiene superficie cargada: sin eso no hay nada que escalar', 400)
  }

  const obras = await obrasDelTenant(tenantId)
  if (obras.length === 0) {
    throw new AuthError(
      'Todavía no hay obras de referencia cargadas. La primera vez hay que subir una estructura de producto: a partir de ahí el despiece se propone solo.',
      409,
    )
  }

  const elegida = obraElegidaId
    ? obras.find((o) => o.id === obraElegidaId)
    : obras.map((o) => comparar(g, o)).sort((a, b) => a.distancia - b.distancia)[0].obra
  if (!elegida) throw new AuthError('La obra de referencia no existe', 404)

  const items = await db.query.obrasReferenciaItems.findMany({
    where: eq(obrasReferenciaItems.obraId, elegida.id),
    orderBy: [asc(obrasReferenciaItems.orden)],
  })
  if (items.length === 0) {
    throw new AuthError('La obra de referencia no tiene renglones cargados', 409)
  }

  return escalar(elegida, items, g)
}

/* ─── Aprender de lo que se carga ─────────────────────────────── */

/**
 * Guarda el despiece de una orden como obra de referencia.
 *
 * Es lo que cierra el círculo: la estructura que oficina técnica sube hoy
 * —o la propuesta que corrige— queda disponible como patrón para la próxima
 * obra. Se guarda el despiece COMPLETO de la orden, no sólo el archivo recién
 * importado, para que el patrón no quede partido.
 *
 * Sin geometría no se guarda: sin el denominador, el despiece no se puede
 * escalar a otra obra.
 */
export async function registrarObraReferencia(
  tenantId: string,
  proyectoId: string,
  nombre: string,
  lineas: Array<{ subconjunto: string; codigo: string; descripcion: string; unidad: string; cantidad: number }>,
  usuarioId: string | null,
): Promise<ObraReferencia | null> {
  const dt = await db.query.datosTecnicos.findFirst({
    where: eq(datosTecnicos.proyectoId, proyectoId),
  })
  const g = geometriaDe(dt)
  if (!g.superficie || lineas.length === 0) return null

  const previa = await db.query.obrasReferencia.findFirst({
    where: and(eq(obrasReferencia.tenantId, tenantId), eq(obrasReferencia.proyectoId, proyectoId)),
  })

  const valores = {
    tenantId,
    proyectoId,
    nombre,
    tipologia: g.tipologia,
    ancho: g.ancho,
    largo: g.largo,
    alturaLibre: g.alturaLibre,
    superficie: g.superficie,
    tipoCubierta: dt?.tipoCubierta ?? '',
    tipoCerramiento: dt?.tipoCerramiento ?? '',
    cargadaPor: usuarioId,
  }

  let obra: ObraReferencia
  if (previa) {
    const [fila] = await db
      .update(obrasReferencia).set(valores).where(eq(obrasReferencia.id, previa.id)).returning()
    obra = fila
    await db.delete(obrasReferenciaItems).where(eq(obrasReferenciaItems.obraId, obra.id))
  } else {
    const [fila] = await db.insert(obrasReferencia).values(valores).returning()
    obra = fila
  }

  await db.insert(obrasReferenciaItems).values(
    lineas.map((l, i) => ({
      obraId: obra.id,
      subconjunto: l.subconjunto,
      codigo: l.codigo,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidad: l.cantidad,
      base: baseSugerida(l.subconjunto),
      orden: i,
    })),
  )

  return obra
}
