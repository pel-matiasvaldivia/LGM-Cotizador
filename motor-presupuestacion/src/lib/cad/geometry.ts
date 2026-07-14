// Modelo estructural "base" derivado de los datos técnicos del presupuesto.
// Es la fuente única que consumen tanto el exportador DXF (AutoCAD) como el
// IFC (Tekla): así ambos archivos describen exactamente la misma nave.
//
// Sistema de coordenadas (metros):
//   X → longitudinal (largo de la nave)
//   Y → transversal  (luz / ancho)
//   Z → vertical      (altura)

import type { DatosTecnicosRow } from '@/db/schema'

export interface Punto {
  x: number
  y: number
  z: number
}

export type TipoMiembro = 'columna' | 'cabio' | 'viga_borde' | 'cumbrera'

export interface Miembro {
  tipo: TipoMiembro
  a: Punto
  b: Punto
}

export interface Apertura {
  tipo: 'porton'
  // Sobre el muro frontal (plano X=0): la apertura corre en Y desde `y` a `y+ancho`.
  y: number
  ancho: number
  alto: number
}

export interface NaveGeometria {
  ancho: number // luz transversal
  largo: number // longitud
  altura: number // altura de alero / libre
  pendiente: number // relación pendiente del techo (rise/run sobre media luz)
  cumbrera: number // cota Z de la cumbrera
  nBahias: number
  separacionBahia: number
  ejesX: number[] // posiciones longitudinales de los pórticos transversales
  miembros: Miembro[]
  aperturas: Apertura[]
  incluyePiso: boolean
}

const BAHIA_OBJETIVO = 6 // separación deseada entre pórticos (m)

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Dimensión positiva y finita, con valor por defecto si falta o es absurda.
function dim(v: number | null | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? redondear(n) : fallback
}

function redondear(v: number): number {
  return Math.round(v * 1000) / 1000
}

// Pendiente de techo típica según tipología estructural.
function pendientePorTipologia(tipologia: string | null | undefined): number {
  const t = normalizar(tipologia || '')
  if (t.includes('reticulada')) return 0.08
  if (t.includes('alma llena')) return 0.1
  return 0.1 // alveolar y por defecto
}

export function buildGeometria(dt: Partial<DatosTecnicosRow> | null): NaveGeometria {
  const ancho = dim(dt?.ancho, 20)
  const largo = dim(dt?.largo, 50)
  const altura = dim(dt?.alturaLibre, 8)
  const pendiente = pendientePorTipologia(dt?.tipologia)
  const cumbrera = redondear(altura + (ancho / 2) * pendiente)

  const nBahias = Math.max(1, Math.round(largo / BAHIA_OBJETIVO))
  const separacionBahia = redondear(largo / nBahias)
  const ejesX = Array.from({ length: nBahias + 1 }, (_, i) => redondear(i * separacionBahia))

  const miembros: Miembro[] = []

  // Pórticos transversales (uno por eje): 2 columnas + 2 cabios a la cumbrera.
  for (const x of ejesX) {
    miembros.push({ tipo: 'columna', a: { x, y: 0, z: 0 }, b: { x, y: 0, z: altura } })
    miembros.push({ tipo: 'columna', a: { x, y: ancho, z: 0 }, b: { x, y: ancho, z: altura } })
    const ridge: Punto = { x, y: redondear(ancho / 2), z: cumbrera }
    miembros.push({ tipo: 'cabio', a: { x, y: 0, z: altura }, b: ridge })
    miembros.push({ tipo: 'cabio', a: { x, y: ancho, z: altura }, b: ridge })
  }

  // Vigas de borde longitudinales (aleros) + cumbrera.
  miembros.push({ tipo: 'viga_borde', a: { x: 0, y: 0, z: altura }, b: { x: largo, y: 0, z: altura } })
  miembros.push({ tipo: 'viga_borde', a: { x: 0, y: ancho, z: altura }, b: { x: largo, y: ancho, z: altura } })
  miembros.push({ tipo: 'cumbrera', a: { x: 0, y: redondear(ancho / 2), z: cumbrera }, b: { x: largo, y: redondear(ancho / 2), z: cumbrera } })

  // Portones sobre el muro frontal (X=0), repartidos a lo ancho.
  const aperturas: Apertura[] = []
  if (dt?.incluyePortones) {
    const n = Math.max(1, dt?.cantidadPortones ?? 1)
    const anchoP = redondear(Math.min(5, ancho / (n + 1)))
    const altoP = redondear(Math.min(5, Math.max(2.5, altura - 0.5)))
    const paso = ancho / (n + 1)
    for (let i = 1; i <= n; i++) {
      aperturas.push({ tipo: 'porton', y: redondear(paso * i - anchoP / 2), ancho: anchoP, alto: altoP })
    }
  }

  return {
    ancho,
    largo,
    altura,
    pendiente,
    cumbrera,
    nBahias,
    separacionBahia,
    ejesX,
    miembros,
    aperturas,
    incluyePiso: !!dt?.incluyePiso,
  }
}
