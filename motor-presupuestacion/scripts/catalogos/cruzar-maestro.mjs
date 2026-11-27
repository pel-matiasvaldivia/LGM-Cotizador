// scripts/catalogos/cruzar-maestro.mjs
//
// Cruza el maestro de artículos del ERP contra la tabla técnica de los
// catálogos (datos/catalogos/perfiles-acero.json) y lista los que declaran un
// peso que no coincide con el del proveedor.
//
// El peso viaja dentro del nombre del artículo —"PERFIL C 140X60X20X3.2
// (7.44 KG/M)"— y no se compara contra nada, así que un error de carga se
// propaga a la compra, al costo y al pedido al taller sin que nadie lo vea.
//
//   node scripts/catalogos/cruzar-maestro.mjs --maestro ./Listado.csv [--salida ./desvios.csv]
//
// El maestro se exporta del ERP en Windows-1252, con cada celda como fórmula
// de Excel (="00232"). Las dos cosas se contemplan acá.

import { readFileSync, writeFileSync } from 'node:fs'
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

function decodificar(datos) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(datos)
  } catch {
    return new TextDecoder('windows-1252').decode(datos)
  }
}

/** Celdas `="valor"` y comillas sueltas adentro del texto (1/8"). */
function filasCsv(texto) {
  const limpio = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const cab = limpio.split('\n').find((l) => l.trim() !== '') ?? ''
  const sep = [';', '\t', ','].map((s) => ({ s, n: cab.split(s).length })).sort((a, b) => b.n - a.n)[0].s

  const filas = []
  let campo = ''
  let fila = []
  let comillas = false
  const cierra = (i) => {
    const sig = limpio[i + 1]
    return sig === undefined || sig === sep || sig === '\n'
  }
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"' && cierra(i)) comillas = false
      else campo += c
      continue
    }
    if (c === '"' && (campo === '' || campo === '=')) { campo = ''; comillas = true }
    else if (c === sep) { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else campo += c
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila) }
  return filas
}

const num = (s) => {
  const t = String(s).includes(',') ? String(s).replace(/\./g, '').replace(',', '.') : String(s)
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** El peso que el artículo declara en su propio nombre. */
function pesoDeclarado(d) {
  const m = d.match(/\(\s*([\d.,]+)\s*KG\s*\/\s*M2?\s*\)/i) ?? d.match(/[Xx]\s*([\d.,]+)\s*KG\s*\/\s*M\b/i)
  return m ? num(m[1]) : null
}

/** Busca la ficha del catálogo que corresponde al artículo. */
function buscar(catalogo, desc) {
  const d = desc.toUpperCase().replace(/,/g, '.').replace(/\s+/g, ' ')

  let m = d.match(/PERFIL\s+(C|U)\b.*?(\d{2,3})\s*X\s*(\d{2,3})(?:\s*X\s*(\d{1,2}))?\s*X\s*([\d.]+)\s*(?:MM)?/)
  if (m) {
    const [, tipo, a, b, c, esp] = m
    const dim = c ? `${a}x${b}x${c}` : `${a}x${b}`
    const ficha = catalogo.find((p) => p.familia === `Perfil ${tipo}`
      && p.dimensiones === `${dim} mm` && p.espesorMm === Number(esp))
    if (!ficha) return null
    // Un perfil galvanizado pesa ~1% más que el laminado: hay que comparar
    // contra la columna que corresponde, no contra la primera.
    const galva = /GALVANIZAD/.test(d)
    return {
      ficha,
      galvanizado: galva,
      esperado: galva && ficha.kgMGalvanizado != null ? ficha.kgMGalvanizado : ficha.kgM,
      alternativo: galva ? ficha.kgM : ficha.kgMGalvanizado,
    }
  }

  m = d.match(/PERFIL\s+W\s+(\d{3})\s*X\s*([\d.]+)/)
  if (m) {
    const [, h, kg] = m
    const ficha = catalogo.find((p) => p.familia === 'Perfil W' && p.dimensiones.startsWith(`${h}x`)
      && Math.abs(num(p.dimensiones.split('x')[2]) - Number(kg)) < 0.05)
    return ficha ? { ficha, galvanizado: false, esperado: ficha.kgM, alternativo: null } : null
  }

  m = d.match(/\bUPN\s+(\d{2,3})\b/)
  if (m) {
    const ficha = catalogo.find((p) => p.familia === 'UPN' && p.designacion === `UPN ${m[1]}`)
    return ficha ? { ficha, galvanizado: false, esperado: ficha.kgM, alternativo: null } : null
  }

  m = d.match(/HIERRO\s+(NERVADO|LISO)\s+0?(\d{1,2})\s*MM/)
  if (m) {
    const familia = m[1] === 'NERVADO' ? 'Barra nervada DN A 420 S' : 'Barra lisa AL 220'
    const ficha = catalogo.find((p) => p.familia === familia && p.dimensiones === `Ø ${Number(m[2])} mm`)
    return ficha ? { ficha, galvanizado: false, esperado: ficha.kgM, alternativo: null } : null
  }

  return null
}

/**
 * ¿El peso declarado es exactamente el de OTRO renglón del catálogo? Ese es el
 * error de carga típico: se copia el renglón de al lado de la tabla. Primero
 * se busca en el mismo perfil (otro espesor) y después en toda la familia.
 */
function otroRenglon(catalogo, ficha, peso) {
  // Tolerancia relativa: el nombre suele llevar el peso redondeado a dos
  // decimales, así que 10,10 contra 10,03 sigue siendo el mismo renglón.
  const cerca = (valor) => Math.abs(valor - peso) / valor < 0.008
  const coincide = (p) => cerca(p.kgM) || (p.kgMGalvanizado != null && cerca(p.kgMGalvanizado))
  const mismos = catalogo.filter((p) => p.familia === ficha.familia && p !== ficha)
  return mismos.find((p) => p.dimensiones === ficha.dimensiones && coincide(p))
    ?? mismos.find(coincide)
}

/**
 * Qué explica el desvío. Hay dos candidatos —el peso de otro renglón del
 * catálogo, o la otra columna del mismo renglón (laminado contra
 * galvanizado)— y gana el que esté más cerca del valor declarado. Empatados,
 * gana el del mismo artículo: es la explicación más simple.
 */
function diagnosticar(catalogo, a) {
  const otro = otroRenglon(catalogo, a.m.ficha, a.peso)
  const distOtro = otro
    ? Math.min(
      Math.abs(otro.kgM - a.peso) / otro.kgM,
      otro.kgMGalvanizado != null ? Math.abs(otro.kgMGalvanizado - a.peso) / otro.kgMGalvanizado : Infinity,
    )
    : Infinity

  // El galvanizado pesa ~1% más: confundir una columna con la otra da justo
  // esa diferencia, en cualquiera de los dos sentidos.
  const distColumna = a.m.alternativo != null
    ? Math.abs(a.peso - a.m.alternativo) / a.m.alternativo
    : Infinity

  if (distColumna < 0.008 && distColumna <= distOtro) {
    return a.m.galvanizado
      ? 'declara el peso del laminado, siendo galvanizado'
      : 'declara el peso del galvanizado, siendo laminado'
  }
  if (otro && distOtro < 0.008) {
    return otro.dimensiones === a.m.ficha.dimensiones
      ? `es el peso del mismo perfil en ${otro.espesorMm} mm`
      : `es el peso de otro perfil: ${otro.designacion}`
  }
  if (Math.abs(a.desvio) <= 0.015) return 'diferencia de redondeo en el nombre'
  return 'sin explicación: hay que verificarlo contra el material'
}

function main() {
  const o = args()
  if (!o.maestro) {
    console.error('Uso: --maestro <csv del ERP> [--salida <csv>]')
    process.exit(1)
  }

  const catalogo = JSON.parse(readFileSync(`${RAIZ}/datos/catalogos/perfiles-acero.json`, 'utf8')).perfiles

  const filas = filasCsv(decodificar(readFileSync(resolve(o.maestro))))
  const cab = filas.findIndex((f) => String(f[0]).trim().toLowerCase().startsWith('c') && String(f[1] ?? '').trim().toLowerCase().startsWith('descripci'))
  if (cab < 0) {
    console.error('No se encontró el encabezado (Código / Descripción)')
    process.exit(1)
  }

  const articulos = filas.slice(cab + 1)
    .map((f) => ({ codigo: String(f[0] ?? '').trim(), desc: String(f[1] ?? '').trim().replace(/\s+/g, ' ') }))
    .filter((a) => a.desc)

  const conPeso = articulos.map((a) => ({ ...a, peso: pesoDeclarado(a.desc) })).filter((a) => a.peso != null)
  const cruzados = conPeso.map((a) => ({ ...a, m: buscar(catalogo, a.desc) })).filter((a) => a.m)
  const desvios = cruzados
    .map((a) => ({ ...a, desvio: (a.peso - a.m.esperado) / a.m.esperado }))
    .filter((a) => Math.abs(a.desvio) > 0.01)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio))

  console.log(`${articulos.length} artículos · ${conPeso.length} declaran peso · ${cruzados.length} cruzados contra catálogo`)
  console.log(`Coinciden (±1%): ${cruzados.length - desvios.length} · No coinciden: ${desvios.length}\n`)

  const salida = [['codigo', 'articulo', 'peso_declarado', 'peso_catalogo', 'desvio_pct', 'ficha_catalogo', 'probable_causa'].join(',')]
  for (const a of desvios) {
    const causa = diagnosticar(catalogo, a)
    console.log(`${(a.desvio * 100).toFixed(1).padStart(6)}%  [${a.codigo}] ${a.desc}`)
    console.log(`         declara ${a.peso} · catálogo ${a.m.esperado} — ${causa}`)
    salida.push([a.codigo, `"${a.desc}"`, a.peso, a.m.esperado, (a.desvio * 100).toFixed(2), `"${a.m.ficha.designacion}"`, `"${causa}"`].join(','))
  }

  if (o.salida) {
    writeFileSync(resolve(o.salida), `${salida.join('\n')}\n`)
    console.log(`\n→ ${resolve(o.salida)}`)
  }

  const sinCruzar = conPeso.length - cruzados.length
  if (sinCruzar > 0) {
    console.log(`\n${sinCruzar} artículos declaran peso pero no se pudieron cruzar (tubos, chapas y`)
    console.log('perfiles que no están en los catálogos cargados). No son errores: no hay contra qué compararlos.')
  }
}

main()
