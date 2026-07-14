// Exportador IFC 2x3 (importable en Tekla Structures como modelo de referencia)
// a partir de la geometría base de la nave. Cada miembro se emite como un sólido
// extruido (IfcExtrudedAreaSolid) orientado a lo largo de su eje, dentro de la
// jerarquía espacial estándar Project → Site → Building → Storey.
//
// Se escribe STEP (ISO-10303-21) a mano: sólo depende de `crypto` para GUIDs.

import { randomBytes } from 'node:crypto'
import type { CadMeta } from './dxf'
import type { Miembro, NaveGeometria, Punto } from './geometry'

// ─── Utilidades de vector ──────────────────────────────────────────
type Vec = { x: number; y: number; z: number }
const sub = (b: Punto, a: Punto): Vec => ({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z })
const largoVec = (v: Vec): number => Math.hypot(v.x, v.y, v.z)
const norm = (v: Vec): Vec => {
  const l = largoVec(v) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

// Real en formato STEP: siempre con punto decimal ("8." es válido).
function r(v: number): string {
  const x = Number.isFinite(v) ? v : 0
  return Number.isInteger(x) ? `${x}.` : `${x}`
}

// GUID IFC: 22 caracteres del alfabeto base64 propio de IFC.
const IFC64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'
function ifcGuid(): string {
  const bytes = randomBytes(22)
  let s = ''
  for (let i = 0; i < 22; i++) s += IFC64[bytes[i] % 64]
  return s
}

// Perfiles (m): [ancho, alto] de la sección rectangular por tipo de miembro.
const PERFIL: Record<Miembro['tipo'], [number, number]> = {
  columna: [0.3, 0.3],
  cabio: [0.2, 0.4],
  viga_borde: [0.2, 0.3],
  cumbrera: [0.2, 0.3],
}

const CLASE_IFC: Record<Miembro['tipo'], 'IFCCOLUMN' | 'IFCBEAM'> = {
  columna: 'IFCCOLUMN',
  cabio: 'IFCBEAM',
  viga_borde: 'IFCBEAM',
  cumbrera: 'IFCBEAM',
}

class Step {
  private lines: string[] = []
  private seq = 0
  add(body: string): string {
    const ref = `#${++this.seq}`
    this.lines.push(`${ref}= ${body};`)
    return ref
  }
  point(x: number, y: number, z: number): string {
    return this.add(`IFCCARTESIANPOINT((${r(x)},${r(y)},${r(z)}))`)
  }
  point2(x: number, y: number): string {
    return this.add(`IFCCARTESIANPOINT((${r(x)},${r(y)}))`)
  }
  dir(x: number, y: number, z: number): string {
    return this.add(`IFCDIRECTION((${r(x)},${r(y)},${r(z)}))`)
  }
  body(): string {
    return this.lines.join('\n')
  }
}

export function geometriaToIFC(geo: NaveGeometria, meta: CadMeta): string {
  const s = new Step()

  // Cabecera de propietario/aplicación
  const person = s.add(`IFCPERSON($,$,'LGM',$,$,$,$,$)`)
  const org = s.add(`IFCORGANIZATION($,'LGM Cotizador',$,$,$)`)
  const personOrg = s.add(`IFCPERSONANDORGANIZATION(${person},${org},$)`)
  const app = s.add(`IFCAPPLICATION(${org},'1.0','LGM Cotizador','LGM-COT')`)
  const stamp = Math.floor(Date.now() / 1000)
  const owner = s.add(`IFCOWNERHISTORY(${personOrg},${app},$,.ADDED.,$,$,$,${stamp})`)

  // Unidades (SI, metros / radianes)
  const uLen = s.add(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`)
  const uArea = s.add(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`)
  const uVol = s.add(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`)
  const uAng = s.add(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`)
  const units = s.add(`IFCUNITASSIGNMENT((${uLen},${uArea},${uVol},${uAng}))`)

  // Contexto geométrico 3D
  const origin = s.point(0, 0, 0)
  const zdir = s.dir(0, 0, 1)
  const xdir = s.dir(1, 0, 0)
  const wcs = s.add(`IFCAXIS2PLACEMENT3D(${origin},${zdir},${xdir})`)
  const ctx = s.add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${wcs},$)`)

  // Placement identidad reutilizable para la jerarquía espacial
  const idPlc = s.add(`IFCAXIS2PLACEMENT3D(${origin},$,$)`)
  const siteLP = s.add(`IFCLOCALPLACEMENT($,${idPlc})`)
  const bldgLP = s.add(`IFCLOCALPLACEMENT(${siteLP},${idPlc})`)
  const storeyLP = s.add(`IFCLOCALPLACEMENT(${bldgLP},${idPlc})`)

  // Jerarquía espacial
  const project = s.add(`IFCPROJECT('${ifcGuid()}',${owner},'${esc(meta.codigo)}',$,$,$,$,(${ctx}),${units})`)
  const site = s.add(`IFCSITE('${ifcGuid()}',${owner},'Sitio',$,$,${siteLP},$,$,.ELEMENT.,$,$,$,$,$)`)
  const building = s.add(`IFCBUILDING('${ifcGuid()}',${owner},'${esc(meta.cliente)}',$,$,${bldgLP},$,$,.ELEMENT.,$,$,$)`)
  const storey = s.add(`IFCBUILDINGSTOREY('${ifcGuid()}',${owner},'Planta Baja',$,$,${storeyLP},$,$,.ELEMENT.,0.)`)
  s.add(`IFCRELAGGREGATES('${ifcGuid()}',${owner},$,$,${project},(${site}))`)
  s.add(`IFCRELAGGREGATES('${ifcGuid()}',${owner},$,$,${site},(${building}))`)
  s.add(`IFCRELAGGREGATES('${ifcGuid()}',${owner},$,$,${building},(${storey}))`)

  // Elementos estructurales
  const elementos: string[] = []
  let i = 0
  for (const m of geo.miembros) {
    elementos.push(emitirMiembro(s, m, owner, storeyLP, ctx, `${etiqueta(m.tipo)}-${++i}`))
  }
  if (geo.incluyePiso) {
    elementos.push(emitirPiso(s, geo, owner, storeyLP, ctx))
  }

  s.add(
    `IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',${owner},$,$,(${elementos.join(',')}),${storey})`
  )

  return ensamblar(s.body(), meta)
}

// Un miembro lineal como sólido extruido orientado según su eje.
function emitirMiembro(
  s: Step,
  m: Miembro,
  owner: string,
  storeyLP: string,
  ctx: string,
  nombre: string
): string {
  const d = norm(sub(m.b, m.a))
  const depth = largoVec(sub(m.b, m.a))
  // Referencia (X local) perpendicular al eje
  const helper: Vec = Math.abs(d.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }
  const ref = norm(cross(helper, d))

  const pos = s.point(m.a.x, m.a.y, m.a.z)
  const axis = s.dir(d.x, d.y, d.z)
  const rdir = s.dir(ref.x, ref.y, ref.z)
  const a2p = s.add(`IFCAXIS2PLACEMENT3D(${pos},${axis},${rdir})`)
  const lp = s.add(`IFCLOCALPLACEMENT(${storeyLP},${a2p})`)

  const [w, h] = PERFIL[m.tipo]
  const p2 = s.point2(0, 0)
  const prof2d = s.add(`IFCAXIS2PLACEMENT2D(${p2},$)`)
  const profile = s.add(`IFCRECTANGLEPROFILEDEF(.AREA.,'${m.tipo}',${prof2d},${r(w)},${r(h)})`)
  const solidPos = s.add(`IFCAXIS2PLACEMENT3D(${s.point(0, 0, 0)},$,$)`)
  const extrudeDir = s.dir(0, 0, 1)
  const solid = s.add(`IFCEXTRUDEDAREASOLID(${profile},${solidPos},${extrudeDir},${r(depth)})`)
  const shapeRep = s.add(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`)
  const pds = s.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shapeRep}))`)

  const clase = CLASE_IFC[m.tipo]
  return s.add(`${clase}('${ifcGuid()}',${owner},'${esc(nombre)}',$,$,${lp},${pds},$)`)
}

// Losa de piso (IfcSlab) cubriendo la huella de la nave.
function emitirPiso(s: Step, geo: NaveGeometria, owner: string, storeyLP: string, ctx: string): string {
  const pos = s.point(0, 0, 0)
  const a2p = s.add(`IFCAXIS2PLACEMENT3D(${pos},$,$)`)
  const lp = s.add(`IFCLOCALPLACEMENT(${storeyLP},${a2p})`)

  // Perfil rectangular centrado en la huella
  const centro = s.point2(geo.largo / 2, geo.ancho / 2)
  const prof2d = s.add(`IFCAXIS2PLACEMENT2D(${centro},$)`)
  const profile = s.add(`IFCRECTANGLEPROFILEDEF(.AREA.,'Piso',${prof2d},${r(geo.largo)},${r(geo.ancho)})`)
  const solidPos = s.add(`IFCAXIS2PLACEMENT3D(${s.point(0, 0, 0)},$,$)`)
  const extrudeDir = s.dir(0, 0, -1) // hacia abajo desde z=0
  const solid = s.add(`IFCEXTRUDEDAREASOLID(${profile},${solidPos},${extrudeDir},0.15)`)
  const shapeRep = s.add(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`)
  const pds = s.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shapeRep}))`)
  return s.add(`IFCSLAB('${ifcGuid()}',${owner},'Piso',$,$,${lp},${pds},$,.FLOOR.)`)
}

function etiqueta(t: Miembro['tipo']): string {
  switch (t) {
    case 'columna':
      return 'Columna'
    case 'cabio':
      return 'Cabio'
    case 'viga_borde':
      return 'Viga'
    case 'cumbrera':
      return 'Cumbrera'
  }
}

// Escapa comillas simples para strings STEP.
function esc(v: string): string {
  return (v || '').replace(/'/g, "''")
}

function ensamblar(data: string, meta: CadMeta): string {
  const now = new Date().toISOString()
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    `FILE_NAME('${esc(meta.codigo)}.ifc','${now}',(''),(''),'LGM Cotizador','LGM Cotizador','');`,
    "FILE_SCHEMA(('IFC2X3'));",
    'ENDSEC;',
    'DATA;',
    data,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n')
}
