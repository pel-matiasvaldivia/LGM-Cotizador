// Exportador DXF (AutoCAD) a partir de la geometría base de la nave.
// Genera un DXF ASCII R12 — el subconjunto más compatible: sólo LINE, CIRCLE
// y TEXT, que cualquier versión de AutoCAD/BricsCAD/LibreCAD abre sin plugins.
//
// El dibujo tiene dos vistas en el mismo espacio modelo:
//   • PLANTA DE EJES  → arriba (Y ≥ 0), en coordenadas reales X/Y.
//   • SECCIÓN TÍPICA  → debajo (Y < 0), pórtico transversal (luz vs. altura).

import type { NaveGeometria } from './geometry'

export interface CadMeta {
  codigo: string
  cliente: string
  tipologia?: string | null
}

// Capas: [nombre, color ACI]
const CAPAS: [string, number][] = [
  ['ENVOLVENTE', 5], // azul
  ['EJES', 8], // gris
  ['COLUMNAS', 1], // rojo
  ['SECCION', 3], // verde
  ['PORTONES', 2], // amarillo
  ['TEXTO', 7], // blanco/negro
]

// Formatea un real para DXF (siempre con punto decimal).
function n(v: number): string {
  return (Number.isFinite(v) ? v : 0).toFixed(4)
}

export function geometriaToDXF(geo: NaveGeometria, meta: CadMeta): string {
  const e: string[] = []
  const line = (capa: string, x1: number, y1: number, x2: number, y2: number) =>
    e.push('0', 'LINE', '8', capa, '10', n(x1), '20', n(y1), '30', '0', '11', n(x2), '21', n(y2), '31', '0')
  const circle = (capa: string, cx: number, cy: number, r: number) =>
    e.push('0', 'CIRCLE', '8', capa, '10', n(cx), '20', n(cy), '30', '0', '40', n(r))
  const text = (capa: string, x: number, y: number, h: number, s: string) =>
    e.push('0', 'TEXT', '8', capa, '10', n(x), '20', n(y), '30', '0', '40', n(h), '1', s)

  const { ancho, largo, altura, cumbrera } = geo

  // ─── PLANTA ────────────────────────────────────────────────────
  // Envolvente
  line('ENVOLVENTE', 0, 0, largo, 0)
  line('ENVOLVENTE', largo, 0, largo, ancho)
  line('ENVOLVENTE', largo, ancho, 0, ancho)
  line('ENVOLVENTE', 0, ancho, 0, 0)
  // Eje longitudinal de cumbrera
  line('EJES', 0, ancho / 2, largo, ancho / 2)
  // Pórticos: eje transversal + marcas de columna en cada apoyo
  for (const x of geo.ejesX) {
    line('EJES', x, 0, x, ancho)
    circle('COLUMNAS', x, 0, 0.3)
    circle('COLUMNAS', x, ancho, 0.3)
  }
  // Portones sobre el muro frontal (X=0): rectángulo hacia el interior
  for (const ap of geo.aperturas) {
    const d = 0.6
    line('PORTONES', 0, ap.y, d, ap.y)
    line('PORTONES', d, ap.y, d, ap.y + ap.ancho)
    line('PORTONES', d, ap.y + ap.ancho, 0, ap.y + ap.ancho)
  }

  // ─── SECCIÓN TRANSVERSAL TÍPICA (debajo de la planta) ──────────
  // Mapea (Y, Z) → (x = Y, y = base + Z), con base negativo para no solapar.
  const base = -(cumbrera + 8)
  const sy = (z: number) => base + z
  line('SECCION', 0, sy(0), ancho, sy(0)) // terreno
  line('SECCION', 0, sy(0), 0, sy(altura)) // columna izq
  line('SECCION', ancho, sy(0), ancho, sy(altura)) // columna der
  line('SECCION', 0, sy(altura), ancho / 2, sy(cumbrera)) // cabio izq
  line('SECCION', ancho, sy(altura), ancho / 2, sy(cumbrera)) // cabio der

  // ─── RÓTULOS ───────────────────────────────────────────────────
  const tituloY = ancho + 6
  text('TEXTO', 0, tituloY + 3, 1.2, `LGM - ${meta.codigo}`)
  text('TEXTO', 0, tituloY + 1, 0.8, `Cliente: ${meta.cliente}`)
  text('TEXTO', 0, tituloY - 0.6, 0.8, `Luz ${n(ancho)} m  |  Largo ${n(largo)} m  |  Altura ${n(altura)} m`)
  if (meta.tipologia) text('TEXTO', 0, tituloY - 2.2, 0.8, `Tipologia: ${meta.tipologia}`)
  text('TEXTO', 0, ancho + 1.5, 0.8, 'PLANTA DE EJES')
  text('TEXTO', 0, base - 2, 0.8, 'SECCION TRANSVERSAL TIPICA')

  // ─── ENSAMBLADO DEL ARCHIVO ────────────────────────────────────
  const out: string[] = []
  // Cabecera mínima: unidades en metros
  out.push('0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC')
  // Tabla de capas
  out.push('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(CAPAS.length))
  for (const [nombre, color] of CAPAS) {
    out.push('0', 'LAYER', '2', nombre, '70', '0', '62', String(color), '6', 'CONTINUOUS')
  }
  out.push('0', 'ENDTAB', '0', 'ENDSEC')
  // Entidades
  out.push('0', 'SECTION', '2', 'ENTITIES', ...e, '0', 'ENDSEC', '0', 'EOF')
  return out.join('\n') + '\n'
}
