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
  /**
   * Existencia que traía la exportación del ERP, si la traía. Es el stock
   * general del artículo, no una reserva para esta obra: sirve como punto de
   * partida de la verificación, nunca como la verificación misma.
   */
  stock: number | null
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
  stock: ['stock', 'existencia', 'existencias'],
} as const

// Unidades que usa el catálogo. Sirven para reconocer la columna cuando la
// exportación sale descuadrada y la unidad no cae donde debería.
const UNIDADES = new Set([
  'kg', 'un', 'u', 'm', 'm2', 'm3', 'ml', 'mt', 'lt', 'l', 'tn', 'gl', 'jg', 'par', 'hs',
])

type Columna = keyof typeof ENCABEZADOS

/**
 * El ERP exporta cada celda como fórmula de Excel: `="00232"`, `="KG "`. Sin
 * desenvolverla, el código queda con comillas y la sangría del árbol —que va
 * adentro del texto— no se ve.
 */
export function celda(valor: Celda): string {
  const texto = String(valor ?? '')
  const m = texto.match(/^\s*=\s*"([\s\S]*)"\s*$/)
  return m ? m[1] : texto
}

export function normalizarTexto(valor: Celda): string {
  return celda(valor)
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
  const texto = celda(valor)
  return texto.length - texto.trimStart().length
}

/**
 * La unidad, aunque la exportación venga corrida. Pasa cuando el ERP exporta
 * con coma como separador y los importes llevan coma decimal: cada importe se
 * parte en dos y todo lo que sigue se desplaza.
 */
function unidadDe(fila: Celda[], indice: number | undefined): { unidad: string; corrida: boolean } {
  const directa = indice !== undefined ? celda(fila[indice]).trim().toLowerCase() : ''
  if (UNIDADES.has(directa)) return { unidad: directa, corrida: false }
  for (const c of fila) {
    const t = celda(c).trim().toLowerCase()
    // La unidad está, pero en otra columna: la fila se corrió.
    if (UNIDADES.has(t)) return { unidad: t, corrida: true }
  }
  return { unidad: directa, corrida: false }
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

  const anchoCabecera = filas[cabecera.fila].length
  const crudas = filas
    .slice(cabecera.fila + 1)
    .map((fila, i) => ({
      fila: cabecera.fila + i + 2, // 1-based, como lo ve quien abre la planilla
      codigo: mapa.codigo !== undefined ? celda(fila[mapa.codigo]).trim() : '',
      descripcion: celda(fila[mapa.descripcion!]).trim(),
      ...(() => {
        const u = unidadDe(fila, mapa.unidad)
        return { unidad: u.unidad, corrida: u.corrida }
      })(),
      cantidad: numeroArg(celda(fila[mapa.cantidad!])),
      stock: mapa.stock !== undefined ? numeroArg(celda(fila[mapa.stock])) : null,
      subconjuntoCol: mapa.subconjunto !== undefined ? celda(fila[mapa.subconjunto]).trim() : '',
      nivel: mapa.nivel !== undefined ? numeroArg(celda(fila[mapa.nivel])) : null,
      sangria: sangria(fila[mapa.descripcion!]),
      descuadrada: fila.length > anchoCabecera,
    }))
    .filter((r) => r.descripcion !== '')

  // Una fila con más campos que el encabezado es una exportación rota: el ERP
  // salió con coma como separador y los importes llevan coma decimal, así que
  // cada importe se partió en dos. La cantidad todavía se lee bien, pero las
  // columnas de la derecha ya no son las que dicen ser.
  if (crudas.some((r) => r.descuadrada || r.corrida)) {
    advertencias.push(
      'Las columnas de esta exportación están corridas: la unidad de medida no cae donde dice el ' +
      'encabezado. Pasa cuando el ERP exporta con coma como separador y los importes llevan coma ' +
      'decimal, porque cada importe se parte en dos. Las cantidades se leen igual, pero el stock ' +
      'no se toma. Conviene volver a exportar con punto y coma.',
    )
  }

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

  // Con sangría el árbol puede tener más de dos niveles: un subconjunto que
  // cuelga de otro (un porta tensor que a su vez lleva su perfil). El material
  // es la HOJA: el renglón que no tiene nada colgando. Los intermedios son
  // conjuntos que se fabrican, no cosas que se compran, y contarlos duplicaría
  // el material de sus hijos.
  const rutas = new Map<number, string>()
  const hojas = new Set<number>()
  if (metodo === 'sangria') {
    const pila: Array<{ sangria: number; nombre: string }> = []
    crudas.forEach((r, i) => {
      while (pila.length > 0 && pila[pila.length - 1].sangria >= r.sangria) pila.pop()
      rutas.set(i, pila.map((p) => p.nombre).join(' › '))
      const siguiente = crudas[i + 1]
      if (!siguiente || siguiente.sangria <= r.sangria) hojas.add(i)
      pila.push({ sangria: r.sangria, nombre: r.descripcion.replace(/\s+/g, ' ') })
    })
  }

  const lineas: LineaDespiece[] = []
  let actual = ''

  for (const [i, r] of crudas.entries()) {
    const esEncabezado = (() => {
      switch (metodo) {
        case 'columna':
          // El renglón que nombra al grupo no trae cantidad útil.
          return !r.subconjuntoCol && (r.cantidad == null || r.cantidad === 0)
        case 'nivel':
          return (r.nivel ?? nivelBase) <= nivelBase
        case 'sangria':
          return !hojas.has(i)
        case 'prefijo':
          return prefijo != null && r.descripcion.startsWith(`${prefijo}_`)
        default:
          return false
      }
    })()

    if (esEncabezado) {
      actual = r.descripcion.replace(/\s+/g, ' ')
      omitidos.push({
        fila: r.fila,
        descripcion: actual,
        motivo: r.sangria > 0 ? 'Conjunto del árbol: lo componen los renglones de abajo' : 'Subconjunto del árbol, no es material',
      })
      continue
    }

    const subconjunto = metodo === 'columna' && r.subconjuntoCol
      ? r.subconjuntoCol
      : metodo === 'sangria' ? (rutas.get(i) || actual) : actual
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
      // El stock negativo del ERP (entregado sin ingresar) no es una
      // existencia: para verificar, es cero.
      stock: r.corrida || r.stock == null ? null : Math.max(r.stock, 0),
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

/**
 * Texto del archivo. El ERP exporta en Windows-1252, no en UTF-8: leído como
 * UTF-8, "Descripción" y cada acento del catálogo quedan rotos. Se intenta
 * UTF-8 estricto y, si no valida, se cae a Windows-1252.
 */
export function decodificar(datos: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(datos)
  } catch {
    return new TextDecoder('windows-1252').decode(datos)
  }
}

/**
 * CSV con separador autodetectado (punto y coma, tabulación o coma).
 *
 * Tolerante a propósito, porque lo que exporta el ERP no es CSV de manual:
 * cada celda viene como fórmula de Excel (`="00232"`) y adentro del texto hay
 * comillas sueltas, como en `CHAPA 1/8" (3,2 MM)`. Un parser estricto toma esa
 * comilla como fin de campo y a partir de ahí la fila entera se corre.
 *
 * La regla: una comilla cierra sólo si después viene el separador, un salto de
 * línea o el fin del archivo. Cualquier otra es parte del texto.
 */
export function filasDesdeCsv(texto: string): Celda[][] {
  const limpio = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n')

  // El separador se decide por el encabezado: en los datos, las comas decimales
  // de los importes ganarían la cuenta y romperían un archivo con punto y coma.
  const encabezado = limpio.split('\n').find((l) => l.trim() !== '') ?? ''
  const sep = [';', '\t', ',']
    .map((s) => ({ s, n: encabezado.split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s

  const filas: Celda[][] = []
  let campo = ''
  let fila: Celda[] = []
  let comillas = false

  const cierra = (i: number) => {
    const sig = limpio[i + 1]
    return sig === undefined || sig === sep || sig === '\n'
  }

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"' && cierra(i)) {
        comillas = false
      } else {
        campo += c
      }
      continue
    }
    // Apertura: al principio del campo, o justo después del `=` de Excel.
    if (c === '"' && (campo === '' || campo === '=')) {
      campo = ''
      comillas = true
    } else if (c === sep) {
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
