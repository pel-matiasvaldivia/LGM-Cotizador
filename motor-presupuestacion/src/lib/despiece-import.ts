// lib/despiece-import.ts — Interpreta la estructura de producto del ERP.
//
// Lo que oficina técnica arma hoy en Flexxus es un árbol: el producto de la
// obra se abre en subconjuntos (columnas, vigas, correas, cierre lateral,
// fundaciones) y cada subconjunto en artículos reales con su unidad física.
// Este módulo lo convierte en el despiece de materiales de la orden.
//
// Es lógica pura: recibe la matriz de filas (ver xlsx-lite o el CSV) y produce
// un preview para revisar antes de aplicarlo. No toca la base.
//
// La exportación no viene siempre igual, así que el subconjunto se deduce en
// este orden: columna explícita → columna de nivel → sangría en el nombre →
// prefijo común (OBRA_SUBCONJUNTO, que es como el ERP nombra el árbol). Lo que
// se dedujo se informa en el preview: acá nada se adivina en silencio.

export interface LineaDespiece {
  subconjunto: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  /** Fila de la planilla, para poder señalar el problema. */
  fila: number
}

export interface PreviewDespiece {
  lineas: LineaDespiece[]
  subconjuntos: string[]
  /** Cómo se dedujo el agrupamiento, para mostrarlo antes de aplicar. */
  metodoSubconjunto: 'columna' | 'nivel' | 'sangria' | 'prefijo' | 'ninguno'
  /** Renglones de encabezado del árbol: no son material. */
  omitidos: Array<{ fila: number; descripcion: string; motivo: string }>
  advertencias: string[]
}

type Celda = string | number | null

const ENCABEZADOS = {
  codigo: ['codigo', 'cod', 'articulo codigo', 'cod articulo', 'cod.'],
  descripcion: ['articulo', 'descripcion', 'detalle', 'material', 'producto'],
  cantidad: ['unidades', 'cantidad', 'cant', 'cant.'],
  unidad: ['uni med', 'unidad', 'un med', 'u med', 'medida', 'uni. med.'],
  subconjunto: ['subconjunto', 'conjunto', 'grupo', 'padre', 'componente'],
  nivel: ['nivel', 'level', 'orden nivel'],
} as const

type Columna = keyof typeof ENCABEZADOS

export function normalizarTexto(valor: Celda): string {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Número con formato argentino: coma decimal y punto de miles. "11.160,0000"
 * y "11160,0000" valen lo mismo; "1160.5" también, porque algunas
 * exportaciones salen con punto decimal.
 */
export function numeroArg(valor: Celda): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  const limpio = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto.replace(/(?<=\d)\.(?=\d{3}\b)/g, '')
  const n = Number(limpio.replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Ubica la fila de encabezados y a qué columna corresponde cada posición. */
function mapearColumnas(filas: Celda[][]): { fila: number; mapa: Partial<Record<Columna, number>> } | null {
  const limite = Math.min(filas.length, 30)
  for (let f = 0; f < limite; f++) {
    const mapa: Partial<Record<Columna, number>> = {}
    filas[f].forEach((celda, i) => {
      const texto = normalizarTexto(celda)
      if (!texto) return
      for (const [columna, alias] of Object.entries(ENCABEZADOS) as Array<[Columna, readonly string[]]>) {
        if (mapa[columna] !== undefined) continue
        if (alias.some((a) => texto === a || texto.startsWith(`${a} `))) mapa[columna] = i
      }
    })
    // Hace falta al menos saber qué es cada cosa y cuánto.
    if (mapa.descripcion !== undefined && mapa.cantidad !== undefined) return { fila: f, mapa }
  }
  return null
}

/** Sangría del nombre del artículo: el ERP la usa para marcar el nivel. */
function sangria(valor: Celda): number {
  const texto = String(valor ?? '')
  const espacios = texto.length - texto.trimStart().length
  return Math.floor(espacios / 2)
}

/** OBRA_SUBCONJUNTO: prefijo antes del guion bajo, cuando se repite. */
function prefijoComun(descripciones: string[]): string | null {
  const conteo = new Map<string, number>()
  for (const d of descripciones) {
    const i = d.indexOf('_')
    if (i <= 0) continue
    const prefijo = d.slice(0, i).trim()
    if (prefijo.length < 3) continue
    conteo.set(prefijo, (conteo.get(prefijo) ?? 0) + 1)
  }
  let mejor: string | null = null
  let max = 0
  for (const [prefijo, n] of conteo) {
    if (n > max) {
      max = n
      mejor = prefijo
    }
  }
  // Con menos de dos apariciones no es un árbol, es una coincidencia.
  return max >= 2 ? mejor : null
}

export function interpretarDespiece(filas: Celda[][]): PreviewDespiece {
  const advertencias: string[] = []
  const omitidos: PreviewDespiece['omitidos'] = []

  const cabecera = mapearColumnas(filas)
  if (!cabecera) {
    return {
      lineas: [],
      subconjuntos: [],
      metodoSubconjunto: 'ninguno',
      omitidos: [],
      advertencias: [
        'No se encontró la fila de encabezados. Hace falta al menos una columna de artículo o descripción y una de cantidad.',
      ],
    }
  }

  const { mapa } = cabecera
  if (mapa.unidad === undefined) {
    advertencias.push('La planilla no trae columna de unidad de medida: los renglones quedan sin unidad.')
  }
  if (mapa.codigo === undefined) {
    advertencias.push('La planilla no trae columna de código de artículo: no se va a poder cruzar con el ERP.')
  }

  const crudas = filas
    .slice(cabecera.fila + 1)
    .map((fila, i) => ({
      fila: cabecera.fila + i + 2, // 1-based, como lo ve quien abre la planilla
      codigo: mapa.codigo !== undefined ? String(fila[mapa.codigo] ?? '').trim() : '',
      descripcionCruda: String(fila[mapa.descripcion!] ?? ''),
      descripcion: String(fila[mapa.descripcion!] ?? '').trim(),
      unidad: mapa.unidad !== undefined ? String(fila[mapa.unidad] ?? '').trim() : '',
      cantidad: numeroArg(fila[mapa.cantidad!]),
      subconjuntoCol: mapa.subconjunto !== undefined ? String(fila[mapa.subconjunto] ?? '').trim() : '',
      nivel: mapa.nivel !== undefined ? numeroArg(fila[mapa.nivel]) : null,
      sangria: sangria(fila[mapa.descripcion!]),
    }))
    .filter((r) => r.descripcion !== '')

  if (crudas.length === 0) {
    return { lineas: [], subconjuntos: [], metodoSubconjunto: 'ninguno', omitidos: [], advertencias: ['La planilla no tiene renglones.'] }
  }

  // ¿Cómo sabemos qué es subconjunto y qué es material?
  let metodo: PreviewDespiece['metodoSubconjunto'] = 'ninguno'
  if (crudas.some((r) => r.subconjuntoCol)) metodo = 'columna'
  else if (crudas.some((r) => r.nivel != null)) metodo = 'nivel'
  else if (crudas.some((r) => r.sangria > 0)) metodo = 'sangria'
  else if (prefijoComun(crudas.map((r) => r.descripcion))) metodo = 'prefijo'

  const prefijo = metodo === 'prefijo' ? prefijoComun(crudas.map((r) => r.descripcion)) : null
  const nivelBase = metodo === 'nivel' ? Math.min(...crudas.map((r) => r.nivel ?? 0)) : 0

  const lineas: LineaDespiece[] = []
  let actual = ''

  for (const r of crudas) {
    const esEncabezado = (() => {
      switch (metodo) {
        case 'columna':
          // El renglón que nombra al grupo no trae cantidad útil.
          return !r.subconjuntoCol && (r.cantidad == null || r.cantidad === 0)
        case 'nivel':
          return (r.nivel ?? nivelBase) <= nivelBase
        case 'sangria':
          return r.sangria === 0
        case 'prefijo':
          return prefijo != null && r.descripcion.startsWith(`${prefijo}_`)
        default:
          return false
      }
    })()

    if (esEncabezado) {
      actual = r.descripcion.replace(/\s+/g, ' ')
      omitidos.push({ fila: r.fila, descripcion: actual, motivo: 'Subconjunto del árbol, no es material' })
      continue
    }

    const subconjunto = metodo === 'columna' && r.subconjuntoCol ? r.subconjuntoCol : actual
    if (r.cantidad == null) {
      omitidos.push({ fila: r.fila, descripcion: r.descripcion, motivo: 'Sin cantidad' })
      continue
    }
    if (r.cantidad <= 0) {
      omitidos.push({ fila: r.fila, descripcion: r.descripcion, motivo: 'Cantidad cero' })
      continue
    }

    lineas.push({
      subconjunto,
      codigo: r.codigo,
      descripcion: r.descripcion.replace(/\s+/g, ' '),
      unidad: r.unidad.toLowerCase(),
      cantidad: r.cantidad,
      fila: r.fila,
    })
  }

  if (metodo === 'ninguno') {
    advertencias.push(
      'No se pudo deducir el agrupamiento por subconjunto: los materiales entran sin agrupar. Agregá una columna "Subconjunto" si querés conservarlo.',
    )
  }
  if (lineas.length === 0) {
    advertencias.push('No quedó ningún renglón de material después de interpretar la planilla.')
  }

  // Un mismo artículo puede aparecer en varios subconjuntos y eso está bien;
  // repetido dentro del mismo subconjunto suele ser un error de la estructura.
  const vistos = new Set<string>()
  for (const l of lineas) {
    const clave = `${l.subconjunto}|${l.codigo || l.descripcion}`
    if (vistos.has(clave)) {
      advertencias.push(`"${l.descripcion}" aparece más de una vez en ${l.subconjunto || 'el despiece'} (fila ${l.fila}).`)
    }
    vistos.add(clave)
  }

  const subconjuntos = [...new Set(lineas.map((l) => l.subconjunto).filter(Boolean))]
  return { lineas, subconjuntos, metodoSubconjunto: metodo, omitidos, advertencias }
}

/** CSV simple con separador autodetectado (coma, punto y coma o tabulación). */
export function filasDesdeCsv(texto: string): Celda[][] {
  const limpio = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const muestra = limpio.split('\n').slice(0, 10).join('\n')
  const sep = [';', '\t', ',']
    .map((s) => ({ s, n: muestra.split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s

  const filas: Celda[][] = []
  let campo = ''
  let fila: Celda[] = []
  let comillas = false

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') {
        comillas = false
      } else {
        campo += c
      }
      continue
    }
    if (c === '"') comillas = true
    else if (c === sep) {
      fila.push(campo)
      campo = ''
    } else if (c === '\n') {
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ''
    } else campo += c
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo)
    filas.push(fila)
  }
  return filas
}
