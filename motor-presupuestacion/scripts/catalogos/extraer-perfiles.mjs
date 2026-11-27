// scripts/catalogos/extraer-perfiles.mjs
//
// Extrae de los catálogos de los proveedores la tabla técnica de perfiles,
// tubos y barras: designación, dimensiones y — lo que importa para la
// explosión de materiales — los kg por metro.
//
// Es la referencia contra la que se valida el maestro de artículos del ERP:
// ese maestro lleva el peso dentro del nombre ("PERFIL C 140X60X20X3.2
// (7.44 KG/M)") y ahí es donde se cuelan los errores de carga.
//
//   node scripts/catalogos/extraer-perfiles.mjs \
//     --ternium ./CATALOGO-TERNIUM.pdf \
//     --acindar ./CATALOGO-ACINDAR.pdf \
//     [--salida ./datos/catalogos]
//
// Necesita `pdftotext` (poppler-utils) en el PATH.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function args() {
  const a = process.argv.slice(2)
  const o = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1]?.startsWith('--') ? true : a[++i]
  }
  return o
}

// pdftotext -layout conserva las columnas con espacios, que es justamente lo
// que necesitamos para resolver las tablas con huecos. El \f de salto de
// página molesta al reconocer los títulos y se saca.
function texto(pdf) {
  return execFileSync('pdftotext', ['-layout', resolve(pdf), '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).replace(/\f/g, '')
}

// Acindar escribe los decimales con coma y los miles con punto; Ternium usa
// punto decimal. Acá sólo entran números chicos (kg/m, mm), así que la coma
// manda: si hay coma, los puntos son de miles.
function num(s) {
  if (s == null) return null
  const t = String(s).trim()
  const limpio = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const v = Number(limpio)
  return Number.isFinite(v) ? v : null
}

// Recorta el bloque de líneas entre un título y el corte siguiente.
function seccion(txt, desde, hasta) {
  const lineas = txt.split('\n')
  const i = lineas.findIndex((l) => desde.test(l))
  if (i < 0) {
    console.warn(`  (sin coincidencia para ${desde})`)
    return []
  }
  const resto = lineas.slice(i + 1)
  const j = hasta ? resto.findIndex((l) => hasta.test(l)) : -1
  return j < 0 ? resto : resto.slice(0, j)
}

// Tokens numéricos de una línea, con la posición en que arrancan: así se
// resuelve a qué columna pertenece cada valor cuando la tabla tiene huecos.
function tokens(linea) {
  const out = []
  const re = /\S+/g
  let m
  while ((m = re.exec(linea)) !== null) out.push({ txt: m[0], ini: m.index, fin: m.index + m[0].length })
  return out
}

const filas = []
const vistos = new Set()
function agregar(r) {
  if (r.kgM == null || !(r.kgM > 0)) return
  const clave = `${r.familia}|${r.designacion}`
  if (vistos.has(clave)) return
  vistos.add(clave)
  filas.push(r)
}

// ─── Ternium: perfiles C y U conformados en frío ────────────────
// Una fila por espesor; la dimensión sólo aparece en la primera del grupo y
// se arrastra hacia abajo.
function terniumConformados(txt, titulo, familia) {
  const lineas = seccion(txt, titulo, /^\s*W\s+Módulo resistente/)
  let dimension = null
  for (const linea of lineas) {
    const l = linea.replace(/\t/g, ' ').trim()
    if (!l) continue
    const conDim = l.match(/^(\d+x\d+(?:x\d+)?)\s+(.*)$/)
    let resto = l
    if (conDim) {
      dimension = conDim[1]
      resto = conDim[2]
    } else if (!/^[\d.,]/.test(l)) {
      continue
    }
    if (!dimension) continue
    const campos = resto.split(/\s+/).filter((c) => c !== '-' && c !== '')
    const espesor = num(campos[0])
    const kgM = num(campos[1])
    if (espesor == null || kgM == null || espesor > 20) continue
    // La columna siguiente es el peso galvanizado cuando existe (~1% más).
    const galva = num(campos[2])
    agregar({
      familia,
      proveedor: 'Ternium',
      designacion: `${familia} ${dimension} x ${espesor} mm`,
      dimensiones: `${dimension} mm`,
      espesorMm: espesor,
      kgM,
      kgMGalvanizado: galva != null && galva >= kgM && galva < kgM * 1.05 ? galva : null,
    })
  }
}

// ─── Ternium: tubos (matriz medida × espesor) ───────────────────
// El encabezado da los espesores y su posición; cada valor de la fila se
// asigna a la columna con la que se solapa, que es la única forma de no
// equivocarse cuando faltan celdas en el medio.
function terniumTubos(txt, titulo, uso, hasta) {
  const lineas = seccion(txt, titulo, hasta)
  let cols = null
  for (const linea of lineas) {
    const l = linea.replace(/\t/g, ' ').trimEnd()
    if (!l.trim()) continue

    if (l.includes('(Pulg)')) {
      cols = tokens(l)
        .filter((t) => /^\d+,\d+$/.test(t.txt))
        .map((t) => ({ espesor: num(t.txt), ini: t.ini, fin: t.fin }))
      continue
    }
    if (!cols || cols.length === 0) continue

    const ts = tokens(l)
    if (ts.length < 2) continue

    // Medida: redondo (pulgadas + mm), cuadrado o rectangular (mm).
    let forma = null
    let medida = null
    let desde = 0
    const esFraccion = (s) => /^\d+$|^\d+\/\d+$/.test(s)
    if (esFraccion(ts[0].txt) && /^\d+\.\d+$/.test(ts[1]?.txt ?? '')) {
      forma = 'redondo'
      medida = `Ø ${ts[1].txt} mm (${ts[0].txt}")`
      desde = 2
    } else if (esFraccion(ts[0].txt) && esFraccion(ts[1]?.txt ?? '') && /^\d+\.\d+$/.test(ts[2]?.txt ?? '')) {
      // Medidas como «2 1/4».
      forma = 'redondo'
      medida = `Ø ${ts[2].txt} mm (${ts[0].txt} ${ts[1].txt}")`
      desde = 3
    } else {
      const i = ts.findIndex((t) => /^\d+x\d+$/.test(t.txt))
      if (i < 0 || i > 2) continue
      const [a, b] = ts[i].txt.split('x').map(Number)
      forma = a === b ? 'cuadrado' : 'rectangular'
      medida = `${ts[i].txt} mm`
      desde = i + 1
    }

    for (const t of ts.slice(desde)) {
      const kgM = num(t.txt)
      if (kgM == null) continue
      // La columna es aquella cuyo rango de caracteres se solapa con el valor.
      const col = cols.find((c) => t.ini <= c.fin && t.fin >= c.ini)
      if (!col) continue
      agregar({
        familia: `Tubo ${forma} ${uso}`,
        proveedor: 'Ternium',
        designacion: `Tubo ${forma} ${medida} x ${col.espesor} mm`,
        dimensiones: medida,
        espesorMm: col.espesor,
        kgM,
        kgMGalvanizado: null,
      })
    }
  }
}

// ─── Acindar: barras para hormigón ──────────────────────────────
// diámetro · perímetro · kg/m · …
function acindarBarras(txt, titulo, familia, hasta) {
  for (const linea of seccion(txt, titulo, hasta)) {
    const c = linea.trim().split(/\s+/)
    const diam = num(c[0])
    const kgM = num(c[2])
    if (diam == null || kgM == null || diam < 4 || diam > 60 || kgM > 20) continue
    agregar({
      familia,
      proveedor: 'Acindar',
      designacion: `${familia} Ø ${diam} mm`,
      dimensiones: `Ø ${diam} mm`,
      espesorMm: null,
      kgM,
      kgMGalvanizado: null,
    })
  }
}

// ─── Acindar: perfiles laminados en caliente ────────────────────
// Todas estas tablas arrancan con la designación y traen la masa nominal por
// unidad de longitud en una posición fija dentro de la fila.
function acindarLaminados(txt, titulo, familia, colMasa, { hasta, dims } = {}) {
  const lineas = seccion(txt, titulo, hasta ?? /^Consultar stock/)
  for (const linea of lineas) {
    const l = linea.trim()
    if (!l || !/^\d/.test(l)) continue
    const c = l.split(/\s+/)
    const kgM = num(c[colMasa])
    if (kgM == null || kgM <= 0 || kgM > 600) continue
    const dimension = dims ? c[dims] : `h ${c[0]} mm`
    agregar({
      familia,
      proveedor: 'Acindar',
      designacion: `${familia} ${c[0]}`,
      dimensiones: dimension,
      espesorMm: null,
      kgM,
      kgMGalvanizado: null,
    })
  }
}

// Ángulo de alas iguales: la designación lleva espacios («1 1/4 x 3/16»), así
// que se ancla por la cola numérica: lado · espesor · r · r1 · sección · masa.
function acindarAngulos(txt) {
  const re = /^(.+?)\s+(\d+,\d+)\s+(\d+,\d+)\s+(\d+(?:,\d+)?)\s+(\d+(?:,\d+)?)\s+(\d+,\d+)\s+(\d+,\d+)\s/
  for (const linea of seccion(txt, /^Ángulo de alas iguales\s*$/, /^Consultar stock/)) {
    const m = linea.trim().match(re)
    if (!m) continue
    const [, desig, lado, espesor, , , , masa] = m
    const kgM = num(masa)
    if (kgM == null || kgM <= 0 || kgM > 200) continue
    agregar({
      familia: 'Ángulo alas iguales',
      proveedor: 'Acindar',
      designacion: `Ángulo ${desig.trim()}`,
      dimensiones: `${num(lado)} x ${num(lado)} x ${num(espesor)} mm`,
      espesorMm: num(espesor),
      kgM,
      kgMGalvanizado: null,
    })
  }
}

// Planchuelas lisas: matriz ancho × espesor, con la misma lógica de columnas
// que los tubos.
function acindarPlanchuelas(txt) {
  const lineas = seccion(txt, /^Planchuelas lisas\s*$/, /^Planchuelas perforadas/)
  let cols = null
  for (const linea of lineas) {
    const l = linea.trimEnd()
    if (!l.trim()) continue
    if (/^pulgadas\s+mm\s/.test(l.trim())) {
      cols = tokens(l)
        .filter((t) => /^\d+(,\d+)?$/.test(t.txt) && num(t.txt) >= 3)
        .map((t) => ({ espesor: num(t.txt), ini: t.ini, fin: t.fin }))
      continue
    }
    if (!cols) continue
    const ts = tokens(l)
    const iAncho = ts.findIndex((t) => /^\d+,\d+$/.test(t.txt))
    if (iAncho < 0) continue
    const ancho = num(ts[iAncho].txt)
    if (ancho == null || ancho < 10 || ancho > 400) continue
    for (const t of ts.slice(iAncho + 1)) {
      const kgM = num(t.txt)
      if (kgM == null) continue
      const col = cols.find((c) => t.ini <= c.fin && t.fin >= c.ini)
      if (!col) continue
      agregar({
        familia: 'Planchuela lisa',
        proveedor: 'Acindar',
        designacion: `Planchuela ${ancho} x ${col.espesor} mm`,
        dimensiones: `${ancho} x ${col.espesor} mm`,
        espesorMm: col.espesor,
        kgM,
        kgMGalvanizado: null,
      })
    }
  }
}

function main() {
  const o = args()
  if (!o.ternium && !o.acindar) {
    console.error('Uso: --ternium <pdf> --acindar <pdf> [--salida <dir>]')
    process.exit(1)
  }

  if (o.ternium) {
    const t = texto(o.ternium)
    terniumConformados(t, /^\s*PERFILES C\s*$/, 'Perfil C')
    terniumConformados(t, /^\s*PERFILES U\s*$/, 'Perfil U')
    terniumTubos(t, /^\s*TUBOS PARA USO ESTRUCTURAL\s*$/, 'estructural', /^\s*Por medidas no inclu/)
    terniumTubos(t, /^\s*TUBOS PARA USO GENERAL\s*$/, 'uso general', /^\s*TUBOS PARA USO ESTRUCTURAL/)
  }

  if (o.acindar) {
    const a = texto(o.acindar)
    acindarBarras(a, /^DN A 420 S®\s*$/, 'Barra nervada DN A 420 S', /^1\. CIRSOC/)
    acindarBarras(a, /^AL 220®\s*$/, 'Barra lisa AL 220', /^Propiedades mecánicas/)
    acindarAngulos(a)
    acindarLaminados(a, /^Normal U \(U\.P\.N\.\)\s*$/, 'UPN', 7)
    acindarLaminados(a, /^Normal doble T \(I\.P\.N\.\)\s*$/, 'IPN', 6)
    acindarLaminados(a, /^I\.P\.B\. \(grey mediano HEB\)\s*$/, 'IPB (HEB)', 6)
    acindarLaminados(a, /^I\.P\.B\.l\. \(grey liviano HEA\)\s*$/, 'IPBl (HEA)', 6)
    acindarLaminados(a, /^I\.P\.E\.\s*$/, 'IPE', 6)
    // W: la designación en mm ya trae el peso (410x140x38,8 → 38,8 kg/m);
    // igual se toma de la columna de masa, que es la que manda.
    acindarLaminados(a, /^W\s*$/, 'Perfil W', 7, { dims: 1 })
    acindarLaminados(a, /^W \(continuación\)\s*$/, 'Perfil W', 7, { dims: 1 })
    acindarPlanchuelas(a)
  }

  const dir = resolve(o.salida ?? `${RAIZ}/datos/catalogos`)
  mkdirSync(dir, { recursive: true })

  filas.sort((a, b) => a.familia.localeCompare(b.familia) || a.kgM - b.kgM)
  writeFileSync(
    `${dir}/perfiles-acero.json`,
    `${JSON.stringify({ generado: new Date().toISOString().slice(0, 10), perfiles: filas }, null, 2)}\n`,
  )

  const cab = ['familia', 'proveedor', 'designacion', 'dimensiones', 'espesorMm', 'kgM', 'kgMGalvanizado']
  const csv = [cab.join(',')]
    .concat(filas.map((f) => cab.map((k) => (f[k] == null ? '' : `"${String(f[k]).replace(/"/g, '""')}"`)).join(',')))
    .join('\n')
  writeFileSync(`${dir}/perfiles-acero.csv`, `${csv}\n`)

  const porFamilia = {}
  for (const f of filas) porFamilia[f.familia] = (porFamilia[f.familia] ?? 0) + 1
  console.log(`${filas.length} perfiles → ${dir}`)
  for (const [k, v] of Object.entries(porFamilia).sort()) console.log(`  ${String(v).padStart(4)}  ${k}`)
}

main()
