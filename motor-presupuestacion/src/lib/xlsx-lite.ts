// lib/xlsx-lite.ts — Lector .xlsx sin dependencias externas.
//
// Un .xlsx es un contenedor ZIP con XMLs adentro. Fiel al estilo del proyecto
// (deps mínimas; el bundle standalone y migrate.mjs sólo dependen de `pg`),
// leemos el ZIP a mano (directorio central + inflate raw con zlib) y parseamos
// el XML con expresiones regulares acotadas. Cubre lo que necesita el
// importador de Base 0: valores de celda (texto compartido, inline, número).
//
// No pretende ser un parser XLSX general: soporta el subconjunto que producen
// Excel/LibreOffice para planillas de datos (sin fórmulas evaluadas más allá
// del valor cacheado, sin estilos).

import { inflateRawSync } from 'node:zlib'

export interface HojaXlsx {
  nombre: string
  // Matriz de filas; cada celda es string, number o null (celda vacía).
  filas: Array<Array<string | number | null>>
}

// ─── ZIP: extracción de entradas vía directorio central ─────────────────────

function leerZip(buf: Buffer): Map<string, Buffer> {
  // End Of Central Directory: firma 0x06054b50, buscada desde el final.
  const EOCD_SIG = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('xlsx inválido: no es un archivo ZIP')

  const totalEntradas = buf.readUInt16LE(eocd + 10)
  let ptr = buf.readUInt32LE(eocd + 16) // offset del directorio central

  const entradas = new Map<string, Buffer>()
  const CD_SIG = 0x02014b50
  const LFH_SIG = 0x04034b50

  for (let i = 0; i < totalEntradas; i++) {
    if (buf.readUInt32LE(ptr) !== CD_SIG) break
    const compresion = buf.readUInt16LE(ptr + 10)
    const compSize = buf.readUInt32LE(ptr + 20)
    const nombreLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const comentarioLen = buf.readUInt16LE(ptr + 32)
    const offsetLocal = buf.readUInt32LE(ptr + 42)
    const nombre = buf.toString('utf8', ptr + 46, ptr + 46 + nombreLen)

    // Ir al Local File Header para ubicar el inicio real de los datos.
    if (buf.readUInt32LE(offsetLocal) === LFH_SIG) {
      const lfhNombreLen = buf.readUInt16LE(offsetLocal + 26)
      const lfhExtraLen = buf.readUInt16LE(offsetLocal + 28)
      const inicio = offsetLocal + 30 + lfhNombreLen + lfhExtraLen
      const crudo = buf.subarray(inicio, inicio + compSize)
      const contenido = compresion === 8 ? inflateRawSync(crudo) : Buffer.from(crudo)
      entradas.set(nombre, contenido)
    }

    ptr += 46 + nombreLen + extraLen + comentarioLen
  }

  return entradas
}

// ─── XML: helpers ───────────────────────────────────────────────────────────

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

function desescapar(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (m, ent, dec, hex) => {
    if (ent) return ENTIDADES[`&${ent};`]
    if (dec) return String.fromCodePoint(Number(dec))
    if (hex) return String.fromCodePoint(parseInt(hex, 16))
    return m
  })
}

// Concatena todos los <t>...</t> de un fragmento (para sharedStrings con runs).
function textoDeNodos(fragmento: string): string {
  let out = ''
  const re = /<t[^>]*>([\s\S]*?)<\/t>|<t\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(fragmento))) out += m[1] ? desescapar(m[1]) : ''
  return out
}

// sharedStrings.xml → array indexado de cadenas.
function leerSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  const out: string[] = []
  const re = /<si>([\s\S]*?)<\/si>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(textoDeNodos(m[1]))
  return out
}

// Convierte la referencia de columna ("A", "B", ..., "AA") a índice 0-based.
function columnaAIndice(ref: string): number {
  const letras = ref.replace(/[0-9]/g, '')
  let n = 0
  for (let i = 0; i < letras.length; i++) {
    n = n * 26 + (letras.charCodeAt(i) - 64)
  }
  return n - 1
}

// ─── Parseo de una hoja ─────────────────────────────────────────────────────

function parsearHoja(xml: string, shared: string[]): Array<Array<string | number | null>> {
  const filas: Array<Array<string | number | null>> = []
  const reFila = /<row[^>]*>([\s\S]*?)<\/row>|<row[^>]*\/>/g
  let mf: RegExpExecArray | null

  while ((mf = reFila.exec(xml))) {
    const cuerpo = mf[1] || ''
    const celdas: Array<string | number | null> = []
    const reCelda = /<c\s+([^>]*?)\/>|<c\s+([^>]*?)>([\s\S]*?)<\/c>/g
    let mc: RegExpExecArray | null

    while ((mc = reCelda.exec(cuerpo))) {
      const attrs = mc[1] || mc[2] || ''
      const interior = mc[3] || ''
      const refMatch = /r="([A-Z]+\d+)"/.exec(attrs)
      const tipoMatch = /t="([^"]+)"/.exec(attrs)
      const tipo = tipoMatch ? tipoMatch[1] : 'n'
      const col = refMatch ? columnaAIndice(refMatch[1]) : celdas.length

      let valor: string | number | null = null
      if (tipo === 's') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(interior)
        if (v) valor = shared[Number(v[1])] ?? null
      } else if (tipo === 'inlineStr') {
        valor = textoDeNodos(interior) || null
      } else if (tipo === 'str') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(interior)
        valor = v ? desescapar(v[1]) : null
      } else {
        // numérico (o booleano, tratado como número)
        const v = /<v>([\s\S]*?)<\/v>/.exec(interior)
        if (v) {
          const n = Number(v[1])
          valor = Number.isFinite(n) ? n : desescapar(v[1])
        }
      }

      // Rellenar huecos de columnas salteadas.
      while (celdas.length < col) celdas.push(null)
      celdas[col] = valor
    }

    filas.push(celdas)
  }

  return filas
}

// ─── API pública ────────────────────────────────────────────────────────────

// Nombres de hoja en el orden del workbook (workbook.xml + rels → sheetN.xml).
function ordenDeHojas(entradas: Map<string, Buffer>): Array<{ nombre: string; archivo: string }> {
  const workbook = entradas.get('xl/workbook.xml')?.toString('utf8') || ''
  const rels = entradas.get('xl/_rels/workbook.xml.rels')?.toString('utf8') || ''

  // rId -> Target (p. ej. worksheets/sheet1.xml)
  const relMap = new Map<string, string>()
  const reRel = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g
  let mr: RegExpExecArray | null
  while ((mr = reRel.exec(rels))) relMap.set(mr[1], mr[2])

  const hojas: Array<{ nombre: string; archivo: string }> = []
  const reSheet = /<sheet\b[^>]*\/>/g
  let ms: RegExpExecArray | null
  while ((ms = reSheet.exec(workbook))) {
    const tag = ms[0]
    const nombre = /name="([^"]*)"/.exec(tag)?.[1] || ''
    const rid = /r:id="([^"]+)"/.exec(tag)?.[1] || ''
    let target = relMap.get(rid) || ''
    if (target && !target.startsWith('xl/')) target = 'xl/' + target.replace(/^\/?/, '')
    hojas.push({ nombre: desescapar(nombre), archivo: target })
  }
  return hojas
}

// Lee un .xlsx (Buffer) y devuelve sus hojas como matrices de filas.
export function leerXlsx(buf: Buffer): HojaXlsx[] {
  const entradas = leerZip(buf)
  const shared = leerSharedStrings(entradas.get('xl/sharedStrings.xml')?.toString('utf8'))
  const orden = ordenDeHojas(entradas)

  const hojas: HojaXlsx[] = []
  const usarOrden = orden.length > 0
  const fuentes = usarOrden
    ? orden
    : [...entradas.keys()]
        .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
        .sort()
        .map((archivo) => ({ nombre: archivo, archivo }))

  for (const { nombre, archivo } of fuentes) {
    const xml = entradas.get(archivo)?.toString('utf8')
    if (!xml) continue
    hojas.push({ nombre, filas: parsearHoja(xml, shared) })
  }
  return hojas
}
