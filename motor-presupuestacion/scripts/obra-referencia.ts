// scripts/obra-referencia.ts
//
// Carga una obra ya hecha como patrón para el motor de explosión, sin tener
// que darla de alta como proyecto.
//
// Es para las obras de antes: las que vienen, el patrón se guarda solo cuando
// oficina técnica carga el despiece. Cuantas más obras haya cargadas, más
// parecida es la que el motor elige para proponer.
//
//   npm run obra-referencia -- \
//     --tenant log-metal --nombre "Casabene" \
//     --ancho 30 --largo 61.6 --altura 8 --tipologia ALVEOLAR \
//     --estructura ./CASABENE_VIGAS.csv --estructura ./CASABENE_COLUMNAS.csv
//
// La superficie sale de ancho × largo, o se fuerza con --m2 cuando la obra no
// es un rectángulo limpio. Cada --estructura es una exportación del ERP; se
// pueden pasar todas las del proyecto en una sola corrida.

import { readFileSync } from 'node:fs'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { obrasReferencia, obrasReferenciaItems, tenants } from '@/db/schema'
import { decodificar, filasDesdeCsv, interpretarDespiece } from '@/lib/despiece-import'
import { baseSugerida } from '@/lib/explosion'
import { leerXlsx } from '@/lib/xlsx-lite'

function args() {
  const a = process.argv.slice(2)
  const o: Record<string, string | true> = {}
  const estructuras: string[] = []
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue
    const clave = a[i].slice(2)
    const valor = a[i + 1]?.startsWith('--') ? true : a[++i]
    if (clave === 'estructura' && typeof valor === 'string') estructuras.push(valor)
    else o[clave] = valor
  }
  return { o, estructuras }
}

async function main() {
  const { o, estructuras } = args()
  const falta = ['tenant', 'nombre'].filter((k) => typeof o[k] !== 'string')
  if (falta.length > 0 || estructuras.length === 0) {
    console.error('Faltan --tenant, --nombre o al menos un --estructura <archivo>')
    console.error('Opcionales: --ancho --largo --altura --m2 --tipologia --notas')
    process.exit(1)
  }

  const empresa = await db.query.tenants.findFirst({ where: eq(tenants.slug, String(o.tenant)) })
  if (!empresa) {
    console.error(`No existe la empresa "${o.tenant}"`)
    process.exit(1)
  }

  const ancho = Number(o.ancho) || 0
  const largo = Number(o.largo) || 0
  const superficie = Number(o.m2) || ancho * largo
  if (!superficie) {
    console.error('Hace falta la superficie: pasá --m2, o --ancho y --largo')
    process.exit(1)
  }

  // Un solo despiece con todos los archivos: el patrón tiene que estar
  // completo, si no la obra nueva sale a la que le faltan subconjuntos.
  const lineas: Array<{ subconjunto: string; codigo: string; descripcion: string; unidad: string; cantidad: number }> = []
  for (const archivo of estructuras) {
    const datos = readFileSync(archivo)
    const filas = archivo.toLowerCase().endsWith('.xlsx')
      ? (leerXlsx(datos)[0]?.filas ?? [])
      : filasDesdeCsv(decodificar(datos))
    const preview = interpretarDespiece(filas)
    console.log(`${archivo}: ${preview.lineas.length} materiales (${preview.metodoSubconjunto})`)
    for (const a of preview.advertencias) console.log(`  ⚠ ${a}`)
    lineas.push(...preview.lineas.map((l) => ({
      subconjunto: l.subconjunto,
      codigo: l.codigo,
      descripcion: l.descripcion,
      unidad: l.unidad,
      cantidad: l.cantidad,
    })))
  }

  if (lineas.length === 0) {
    console.error('Ninguna estructura dio renglones de material')
    process.exit(1)
  }

  const previa = await db.query.obrasReferencia.findFirst({
    where: and(eq(obrasReferencia.tenantId, empresa.id), eq(obrasReferencia.nombre, String(o.nombre))),
  })

  const valores = {
    tenantId: empresa.id,
    nombre: String(o.nombre),
    tipologia: String(o.tipologia ?? '').toUpperCase(),
    ancho,
    largo,
    alturaLibre: Number(o.altura) || 0,
    superficie,
    notas: String(o.notas ?? ''),
  }

  const obra = previa
    ? (await db.update(obrasReferencia).set(valores).where(eq(obrasReferencia.id, previa.id)).returning())[0]
    : (await db.insert(obrasReferencia).values(valores).returning())[0]

  if (previa) await db.delete(obrasReferenciaItems).where(eq(obrasReferenciaItems.obraId, obra.id))

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

  const porBase: Record<string, number> = {}
  for (const l of lineas) {
    const b = baseSugerida(l.subconjunto)
    porBase[b] = (porBase[b] ?? 0) + 1
  }

  console.log(`\n${previa ? 'Actualizada' : 'Cargada'}: ${obra.nombre}`)
  console.log(`  ${superficie} m² · ${ancho} × ${largo} × ${valores.alturaLibre} m${valores.tipologia ? ` · ${valores.tipologia}` : ''}`)
  console.log(`  ${lineas.length} renglones, agrupados por base:`)
  for (const [b, n] of Object.entries(porBase)) console.log(`     ${String(n).padStart(4)}  ${b}`)
  console.log('\nRevisá que la base de cada subconjunto sea la correcta: se dedujo del nombre.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
