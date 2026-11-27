#!/usr/bin/env node
// Genera el manual de operaciones en .docx (editable) con la marca de la
// empresa que corresponda.
//
// La idea es que el manual NO esté atado a ninguna empresa: el texto es el
// mismo para todas, y el logo, los colores y los datos de contacto salen del
// tenant. Así cada empresa que contrata la plataforma recibe su propio manual
// sin que nadie tenga que editar un Word a mano.
//
// Uso:
//   # con la base a mano (lo normal): toma logo, colores y datos del tenant
//   DATABASE_URL=postgres://... node docs/manual-operaciones/generar-manual.mjs --slug log-metal
//
//   # sin base: se le pasa lo mínimo por línea de comandos
//   node docs/manual-operaciones/generar-manual.mjs \
//     --empresa "Mi Empresa S.A." --logo ./logo.png --color "#B01B22"
//
//   # versión genérica, sin marca (para mostrar la plataforma)
//   node docs/manual-operaciones/generar-manual.mjs --empresa "Tu Empresa"
//
// Opciones: --slug --empresa --logo --color --ink --web --salida
//
// Requiere la dependencia `docx` (está en devDependencies).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const IMG = join(AQUI, 'img')

let docx
try {
  docx = await import('docx')
} catch {
  console.error('Falta la dependencia `docx`. Instalala con:  npm install')
  process.exit(1)
}

const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  Header, Footer, PageNumber, PageBreak, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, LevelFormat, convertInchesToTwip,
} = docx

// ─── Argumentos ────────────────────────────────────────────────

function argumentos(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const clave = argv[i].slice(2)
    const valor = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    out[clave] = valor
  }
  return out
}

const args = argumentos(process.argv.slice(2))

// ─── De dónde sale la marca ────────────────────────────────────

const MARCA_NEUTRA = {
  nombre: 'Tu Empresa',
  razonSocial: '',
  cuit: '',
  domicilio: '',
  localidad: '',
  provincia: '',
  telefono: '',
  email: '',
  web: '',
  colorPrimario: '#334155',
  colorInk: '#0F172A',
  logo: null, // { datos: Buffer, tipo: 'png' | 'jpg' }
}

/** Lee el tenant de la base. Devuelve null si no se puede (y se avisa). */
async function marcaDesdeDb(slug) {
  if (!process.env.DATABASE_URL) {
    console.error('--slug necesita DATABASE_URL. Se genera la versión sin marca.')
    return null
  }
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query(
      `SELECT nombre, razon_social, cuit, domicilio, localidad, provincia,
              telefono, email, web, color_primario, color_ink,
              logo_mime, logo_base64
         FROM tenants WHERE slug = $1`,
      [slug],
    )
    if (rows.length === 0) {
      console.error(`No existe la empresa con slug "${slug}".`)
      return null
    }
    const t = rows[0]
    return {
      nombre: t.nombre || MARCA_NEUTRA.nombre,
      razonSocial: t.razon_social || '',
      cuit: t.cuit || '',
      domicilio: t.domicilio || '',
      localidad: t.localidad || '',
      provincia: t.provincia || '',
      telefono: t.telefono || '',
      email: t.email || '',
      web: t.web || '',
      colorPrimario: t.color_primario || MARCA_NEUTRA.colorPrimario,
      colorInk: t.color_ink || MARCA_NEUTRA.colorInk,
      logo: t.logo_base64
        ? { datos: Buffer.from(t.logo_base64, 'base64'), tipo: tipoDeMime(t.logo_mime) }
        : null,
    }
  } finally {
    await pool.end()
  }
}

function tipoDeMime(mime) {
  if (!mime) return 'png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('svg')) return 'svg'
  return 'png'
}

async function resolverMarca() {
  let marca = { ...MARCA_NEUTRA }

  if (args.slug) {
    const deDb = await marcaDesdeDb(args.slug)
    if (deDb) marca = deDb
  }

  // Lo que venga por línea de comandos pisa a la base: sirve para probar.
  if (args.empresa) marca.nombre = args.empresa
  if (args.color) marca.colorPrimario = args.color
  if (args.ink) marca.colorInk = args.ink
  if (args.web) marca.web = args.web
  if (args.logo) {
    const ruta = resolve(process.cwd(), args.logo)
    if (!existsSync(ruta)) {
      console.error(`No encuentro el logo en ${ruta}.`)
      process.exit(1)
    }
    marca.logo = { datos: readFileSync(ruta), tipo: ruta.toLowerCase().endsWith('.jpg') || ruta.toLowerCase().endsWith('.jpeg') ? 'jpg' : 'png' }
  }

  // El SVG no se puede medir ni insertar como las demás: se omite y queda el
  // nombre en texto, que es mejor que un documento roto.
  if (marca.logo && marca.logo.tipo === 'svg') {
    console.error('El logo es SVG: Word no lo inserta acá. Se usa sólo el nombre. Cargá un PNG en Configuración → Empresa.')
    marca.logo = null
  }

  return marca
}

// ─── Medir imágenes (para no deformarlas) ──────────────────────

/** Alto y ancho de un PNG o JPEG, leyendo los bytes. */
function medir(buf) {
  // PNG: IHDR en un offset fijo.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  // JPEG: hay que recorrer los markers hasta un SOF.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      // SOF0..SOF15, salvo los que no llevan dimensiones (C4, C8, CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  return { w: 1000, h: 600 } // último recurso: no deja el documento sin imagen
}

/** Escala una imagen para que entre en una caja, sin deformarla. */
function encajar(buf, maxW, maxH) {
  const { w, h } = medir(buf)
  const k = Math.min(maxW / w, maxH / h, 1)
  return { width: Math.round(w * k), height: Math.round(h * k) }
}

// ─── Ayudas de armado ──────────────────────────────────────────

const ANCHO_UTIL = 620 // px disponibles entre márgenes, para las capturas

function p(texto, opciones = {}) {
  const { bold, size = 21, color = '404040', italics, align, spacing, font = 'Calibri' } = opciones
  return new Paragraph({
    alignment: align,
    spacing: spacing ?? { after: 140, line: 276 },
    children: [new TextRun({ text: texto, bold, italics, size, color, font })],
  })
}

/** Párrafo con partes en negrita: parrafo(['Presioná ', ['Comenzar', true], '.']) */
function parrafo(partes, opciones = {}) {
  return new Paragraph({
    spacing: { after: 140, line: 276 },
    ...opciones,
    children: partes.map((parte) =>
      Array.isArray(parte)
        ? new TextRun({ text: parte[0], bold: true, size: 21, color: '404040', font: 'Calibri' })
        : new TextRun({ text: parte, size: 21, color: '404040', font: 'Calibri' }),
    ),
  })
}

function vineta(partes) {
  return parrafo(partes, { numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 80, line: 276 } })
}

function captura(archivo, epigrafe) {
  const ruta = join(IMG, archivo)
  if (!existsSync(ruta)) {
    console.error(`Falta la captura ${archivo}: se omite.`)
    return []
  }
  const datos = readFileSync(ruta)
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [new ImageRun({ data: datos, type: 'jpg', transformation: encajar(datos, ANCHO_UTIL, 760) })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 260 },
      children: [new TextRun({ text: epigrafe, italics: true, size: 17, color: '808080', font: 'Calibri' })],
    }),
  ]
}

function h1(texto) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(texto)] })
}

function h2(texto) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(texto)] })
}

/** Bloque destacado: un recuadro con fondo suave para avisos y notas. */
function nota(titulo, texto, marca) {
  return new Table({
    width: { size: 9638, type: WidthType.DXA },
    columnWidths: [9638],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      left: { style: BorderStyle.SINGLE, size: 18, color: hex(marca.colorPrimario) },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9638, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'F7F7F7' },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: titulo, bold: true, size: 20, color: hex(marca.colorInk), font: 'Calibri' })],
              }),
              new Paragraph({
                children: [new TextRun({ text: texto, size: 20, color: '404040', font: 'Calibri' })],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function hex(color) {
  return String(color || '').replace('#', '').toUpperCase() || '334155'
}

/** Tabla de datos simple, con encabezado en el color de la marca. */
function tabla(encabezados, filas, anchos, marca) {
  const total = anchos.reduce((a, b) => a + b, 0)
  const celda = (texto, ancho, opciones = {}) =>
    new TableCell({
      width: { size: ancho, type: WidthType.DXA },
      shading: opciones.fondo ? { type: ShadingType.CLEAR, fill: opciones.fondo } : undefined,
      margins: { top: 90, bottom: 90, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [new TextRun({
            text: texto,
            bold: opciones.bold,
            size: 19,
            color: opciones.color || '404040',
            font: 'Calibri',
          })],
        }),
      ],
    })

  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: anchos,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'D9D9D9' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: encabezados.map((t, i) =>
          celda(t, anchos[i], { bold: true, fondo: hex(marca.colorInk), color: 'FFFFFF' })),
      }),
      ...filas.map((fila) => new TableRow({
        children: fila.map((t, i) => celda(t, anchos[i])),
      })),
    ],
  })
}

// ─── El documento ──────────────────────────────────────────────

function construir(marca) {
  const PRIMARIO = hex(marca.colorPrimario)
  const INK = hex(marca.colorInk)
  const EMPRESA = marca.nombre

  // Portada
  const portada = []
  if (marca.logo) {
    portada.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [new ImageRun({
        data: marca.logo.datos,
        type: marca.logo.tipo,
        transformation: encajar(marca.logo.datos, 260, 150),
      })],
    }))
  } else {
    portada.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2800, after: 400 },
      children: [new TextRun({ text: EMPRESA.toUpperCase(), bold: true, size: 36, color: INK, font: 'Calibri' })],
    }))
  }

  portada.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: 'Manual de operaciones', bold: true, size: 52, color: INK, font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'Plataforma de cotización de naves industriales', size: 26, color: PRIMARIO, font: 'Calibri' })],
    }),
    // Sin logo el nombre ya está arriba en grande: no se repite.
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 1600 },
      children: marca.logo
        ? [new TextRun({ text: EMPRESA, size: 24, color: '707070', font: 'Calibri' })]
        : [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `Versión 1.0 · ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`,
        size: 19, color: '909090', font: 'Calibri',
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  )

  // Índice (escrito a mano: siempre muestra algo, sin pedir "actualizar campos")
  const indice = [
    h1('Contenido'),
    ...[
      ['1.', 'Qué es la plataforma'],
      ['2.', 'Puesta en marcha: los datos de la empresa'],
      ['3.', 'Cuentas y roles'],
      ['4.', 'Etapa A · El cliente genera su cotización'],
      ['5.', 'Etapa B · El cliente entra a su portal'],
      ['6.', 'Etapa C · El comercial analiza, modifica y envía'],
      ['7.', 'Etapa D · El cliente ve el presupuesto y pre-aprueba'],
      ['8.', 'Etapa E · Cierre de la venta: contrato y orden de producción'],
      ['9.', 'Etapa F · Producción: del despiece a la entrega en obra'],
      ['10.', 'Notificaciones automáticas por email'],
      ['11.', 'Mantenimiento del catálogo y los parámetros'],
      ['12.', 'Preguntas frecuentes'],
      ['13.', 'Datos de la empresa'],
    ].map(([n, t]) => parrafo([`${n}  ${t}`], { spacing: { after: 90 } })),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  const cuerpo = [
    // ── 1 ──
    h1('1. Qué es la plataforma'),
    parrafo([
      'La plataforma cotiza naves industriales de punta a punta: el cliente arma su nave en un ' +
      'asistente público, el sistema calcula el presupuesto con el motor Base 0, y el equipo comercial ' +
      `de ${EMPRESA} lo revisa, lo ajusta y se lo envía. Todo queda registrado en un mismo lugar.`,
    ]),
    parrafo(['El recorrido tiene cuatro etapas:']),
    vineta([['A. ', true], 'El cliente genera su cotización (canal Web, sin cuenta previa).']),
    vineta([['B. ', true], 'El cliente entra a su portal y sigue el estado de su proyecto.']),
    vineta([['C. ', true], 'El comercial analiza el costeo interno, modifica, descarga el PDF y lo envía.']),
    vineta([['D. ', true], 'El cliente ve el presupuesto y lo pre-aprueba; se coordina la reunión.']),
    vineta([['E. ', true], 'Se cierra la venta: contrato, firma y orden de producción.']),
    parrafo([
      'Este manual recorre las cuatro etapas con capturas reales, tomadas sobre un proyecto de ejemplo: ',
      ['PROY-2026-2912', true],
      ', una nave Alveolar de 20 × 30 × 8 m (600 m²) con oficina interior y baño.',
    ]),
    nota(
      'Sobre los importes',
      'Los valores que aparecen en las capturas (costo interno, precio de venta, IVA y total) son los ' +
      'que produjo el motor Base 0 con la calibración de precios vigente ese día. Son un ejemplo: los ' +
      'de cada presupuesto dependen del catálogo y los parámetros cargados.',
      marca,
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 2 ──
    h1('2. Puesta en marcha: los datos de la empresa'),
    parrafo([
      'Antes de la primera cotización conviene completar los datos de la empresa. Es lo que identifica ' +
      'a la empresa en el sitio público y, sobre todo, lo que se imprime en el presupuesto que recibe el cliente.',
    ]),
    parrafo(['Se carga una sola vez, desde el menú ', ['Empresa', true], ' (visible para el rol ', ['admin', true], ').']),
    h2('Las secciones del formulario'),
    tabla(
      ['Sección', 'Qué se carga', 'Dónde se ve'],
      [
        ['Identidad', 'Nombre comercial y razón social.', 'La razón social es la que firma el presupuesto.'],
        ['Datos fiscales', 'CUIT, condición frente al IVA, Ingresos Brutos, inicio de actividades.', 'El CUIT en el encabezado del presupuesto; el resto, en el pie.'],
        ['Domicilio', 'Domicilio legal/comercial, localidad, provincia y código postal.', 'Encabezado del presupuesto y sección de contacto del sitio.'],
        ['Contacto', 'Teléfono, email, web y WhatsApp.', 'Sitio público y pie del presupuesto.'],
        ['Identidad visual', 'Logo (claro y oscuro), color de acento y color institucional.', 'Todo el sitio, el portal y el PDF. Los hovers, fondos suaves y bordes se derivan solos de esos colores.'],
        ['Cotizador', 'Si el visitante ve el precio estimado mientras arma su nave.', 'El cotizador público. Desactivado, no se muestra ningún precio.'],
        ['Textos del sitio', 'Títulos y textos de la landing.', 'Sitio público. Lo que se deje vacío usa el texto por defecto.'],
        ['Servicios', 'Las tarjetas de servicios del sitio.', 'Sitio público. Sin ninguna cargada, se muestran las que trae el sistema.'],
      ],
      [1500, 4200, 3938],
      marca,
    ),
    p(''),
    nota(
      'Mostrar o no el precio estimado',
      'En la sección Cotizador se decide si el visitante ve un precio orientativo mientras arma su ' +
      'nave. Si se desactiva, el formulario no muestra ningún número en ningún paso y la pantalla ' +
      'final le avisa que el equipo comercial ya tiene su proyecto y se comunica a la brevedad. ' +
      'El presupuesto interno se calcula igual: lo que cambia es sólo lo que ve el visitante.',
      marca,
    ),
    p(''),
    nota(
      'El logo conviene cargarlo en PNG con fondo transparente',
      'Se usa en dos variantes: la clara para fondos blancos (sitio y PDF) y la oscura para la barra ' +
      'superior del portal. Si se carga una sola, se usa esa en los dos lugares.',
      marca,
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 3 ──
    h1('3. Cuentas y roles'),
    parrafo(['Hay tres roles, y cada uno ve cosas distintas:']),
    tabla(
      ['Rol', 'Quién es', 'Qué puede hacer'],
      [
        ['admin', 'El responsable de la cuenta.', 'Todo lo del comercial, más los datos de la empresa, el catálogo, los parámetros y el alta de usuarios.'],
        ['comercial', 'El equipo de ventas.', 'Ver y editar proyectos, modificar presupuestos, descargar el PDF y enviarlo al cliente.'],
        ['cliente', 'Quien pide la cotización.', 'Ver únicamente su propio proyecto en el portal, descargar su PDF y pre-aprobar la oferta.'],
      ],
      [1300, 3200, 5138],
      marca,
    ),
    p(''),
    h2('Sectores del circuito de producción'),
    parrafo([
      'Además del rol, cada persona del equipo interno se asigna a uno o más ', ['sectores', true],
      '. El rol decide a qué parte del sistema entra; el sector, qué pasos del circuito de producción ' +
      'puede dar. Una misma persona puede estar en varios: es lo habitual cuando quien compra también ' +
      'recibe la mercadería.',
    ]),
    tabla(
      ['Sector', 'De qué se ocupa en el circuito'],
      [
        ['Oficina técnica', 'Carga el despiece de materiales, define las partes a fabricar y cierra la orden al terminar.'],
        ['Abastecimiento', 'Verifica el stock, emite el pedido de los faltantes y registra el ingreso de los materiales.'],
        ['Taller', 'Marca el avance de cada parte: pendiente, en fabricación, terminada.'],
        ['Logística y obra', 'Arma los remitos, despacha a la obra y registra el control de llegada.'],
      ],
      [2600, 7038],
      marca,
    ),
    p(''),
    parrafo([
      'El ', ['admin', true], ' entra a todos los sectores, para poder destrabar cuando falta alguien.',
    ]),
    p(''),
    parrafo([
      'Las cuentas de ', ['admin', true], ' y ', ['comercial', true],
      ' las da de alta el administrador desde la barra superior. Las de ', ['cliente', true],
      ' se crean solas: el propio cliente define su contraseña al final del asistente de cotización.',
    ]),
    h2('Confirmación del email del cliente'),
    parrafo([
      'Como el registro del cliente es público, la cuenta recién creada ',
      ['no ve ningún presupuesto hasta confirmar su email', true],
      '. Al terminar el asistente, el sistema le manda un correo con un enlace; mientras no lo use, el ' +
      'portal le muestra el aviso de que falta confirmar. El enlace vale 48 horas y se usa una sola vez.',
    ]),
    nota(
      'Si el cliente dice que no le llegó el correo',
      'Primero que revise el correo no deseado. Si aun así no aparece, el equipo comercial puede seguir ' +
      'trabajando el proyecto con normalidad: la confirmación sólo limita lo que el cliente ve en su ' +
      'portal, no el trabajo interno. Desde el portal el cliente puede pedir que se le reenvíe.',
      marca,
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 4 ──
    h1('4. Etapa A · El cliente genera su cotización'),
    parrafo([
      'Canal Web · pantalla pública ', ['/cotizar', true],
      '. Un asistente guiado en el que el cliente arma su nave y ve un precio orientativo en vivo. ' +
      'Al finalizar, el sistema crea el proyecto y calcula automáticamente el presupuesto Base 0.',
    ]),

    h2('4.1 · Inicio del cotizador'),
    parrafo(['El cliente entra a la pantalla pública y presiona ', ['Comenzar Cotización', true], '. No necesita cuenta todavía.']),
    ...captura('01-cotizar-bienvenida.jpg', 'Pantalla de bienvenida del cotizador.'),

    h2('4.2 · Tipo de estructura'),
    parrafo(['Elige el sistema estructural de la nave: Alveolar, Alma Llena o Reticulada. La selección avanza sola al siguiente paso.']),
    ...captura('02-cotizar-tipologia.jpg', 'Elección de la tipología estructural.'),

    h2('4.3 · Dimensiones y ubicación'),
    parrafo(['Carga ancho, largo, altura libre y la localidad de la obra. En el ejemplo: una nave de 20 × 30 × 8 m (600 m²) en Mendoza.']),
    ...captura('04-cotizar-dimensiones.jpg', 'Dimensiones y localidad de la obra.'),

    h2('4.4 · Tipo de cubierta'),
    parrafo(['Selecciona el material del techo: Chapa Trapezoidal o Panel Sándwich.']),
    ...captura('05-cotizar-cubierta.jpg', 'Elección del tipo de cubierta.'),

    h2('4.5 · Alcance del proyecto'),
    parrafo([
      'El paso clave: el cliente activa lo que necesita. En el ejemplo encendió ', ['Oficina interior', true],
      ' (5 × 6 m), ', ['Baño interior', true], ' e ', ['Instalación eléctrica', true],
      '. Cada opción incorpora sus rubros (tabiques, revestimientos, obra civil, sanitaria…) y el ',
      ['precio estimado se actualiza en vivo', true], ' arriba a la derecha.',
    ]),
    ...captura('07-cotizar-alcance-completo.jpg', 'Alcance del proyecto, con el precio estimado actualizándose en vivo.'),

    h2('4.6 · Planos (opcional)'),
    parrafo(['Puede subir un plano o boceto para que el sistema extraiga más detalles. Es opcional: en el ejemplo se omite.']),
    ...captura('08-cotizar-planos.jpg', 'Carga opcional de planos.'),

    h2('4.7 · Datos de contacto'),
    parrafo(['Completa nombre, empresa, DNI, email y teléfono. Un resumen del proyecto y el precio estimado quedan a la vista antes de confirmar.']),
    ...captura('09-cotizar-contacto.jpg', 'Datos de contacto y resumen del proyecto.'),

    h2('4.8 · Crea su cuenta del portal'),
    parrafo(['Con el mismo email define una contraseña. Estas son las credenciales con las que después entrará a seguir su proyecto.']),
    ...captura('10-cotizar-crear-cuenta.jpg', 'Creación de la cuenta del portal.'),

    h2('4.9 · Consulta registrada'),
    parrafo([
      'Al confirmar, el sistema crea el proyecto (en el ejemplo, el código ', ['PROY-2026-2912', true],
      ') y ejecuta el cálculo del presupuesto Base 0. El cliente ve la confirmación y el aviso de que ' +
      'tiene que confirmar su email.',
    ]),
    ...captura('11-cotizar-gracias.jpg', 'Confirmación de la consulta registrada.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 5 ──
    h1('5. Etapa B · El cliente entra a su portal'),
    parrafo([
      'Portal del cliente · ', ['/mi-proyecto', true],
      '. Con las credenciales recién creadas, el cliente accede para seguir el estado del proyecto en tiempo real.',
    ]),
    h2('5.1 · Estado: Recibido'),
    parrafo([
      'El portal muestra el código del proyecto, una línea de tiempo (Recibido → Presupuesto → ' +
      'Preaprobado → Aprobado) y el detalle técnico de la solicitud. Todavía ',
      ['no hay precio visible', true],
      ': el presupuesto aún no fue enviado por el equipo comercial.',
    ]),
    ...captura('12-cliente-portal-recibido.jpg', 'Portal del cliente con el proyecto en estado Recibido.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 6 ──
    h1('6. Etapa C · El comercial analiza, modifica y envía'),
    parrafo([
      'Portal comercial · ', ['/proyectos', true],
      '. El comercial recibe el proyecto, revisa el costeo interno, ajusta lo que haga falta, descarga ' +
      'el presupuesto y lo envía.',
    ]),

    h2('6.1 · Ingreso al portal comercial'),
    parrafo(['El comercial inicia sesión con sus credenciales en ', ['/login', true], '.']),
    ...captura('14-comercial-login-lleno.jpg', 'Ingreso al portal comercial.'),

    h2('6.2 · Lista de proyectos'),
    parrafo(['Ve el proyecto nuevo generado desde el canal Web, en estado ', ['Borrador', true], ', y lo abre.']),
    ...captura('15-comercial-lista-proyectos.jpg', 'Listado de proyectos.'),

    h2('6.3 · Análisis — Presupuesto Base 0 (interno)'),
    parrafo([
      'La pestaña ', ['Presupuesto Base 0', true],
      ' muestra el costo real de la empresa: cada rubro y subrubro con material, mano de obra e ' +
      'incidencia, más la cascada de costeo (indirectos → beneficio → IVA) y el ',
      ['costo y precio por m²', true], '.',
    ]),
    nota(
      'Esta vista es interna',
      'El Base 0 no se comparte con el cliente: expone el costo de la empresa y los márgenes. Lo que ' +
      've el cliente es la pestaña Presupuesto Cliente, que no muestra ni el costo interno ni el costo por m².',
      marca,
    ),
    ...captura('16-comercial-detalle-base0.jpg', 'Detalle del presupuesto Base 0.'),

    h2('6.4 · Modificación — agregar un ítem'),
    parrafo(['Si el comercial necesita sumar algo que no vino en el Base 0, presiona ', ['Agregar ítem', true], '.']),
    ...captura('17-comercial-modal-agregar-item.jpg', 'Modal para agregar un ítem.'),

    h2('6.5 · Biblioteca de precios'),
    parrafo(['Busca el ítem en la biblioteca de precios de referencia o lo carga a medida.']),
    ...captura('18-comercial-buscar-item.jpg', 'Búsqueda en la biblioteca de precios.'),

    h2('6.6 · Presupuesto recalculado'),
    parrafo(['Al agregar el ítem, el presupuesto se recalcula solo: los totales, la incidencia y el precio por m² se actualizan al instante.']),
    ...captura('19-comercial-item-agregado.jpg', 'Presupuesto recalculado tras agregar el ítem.'),

    h2('6.7 · Vista previa del presupuesto al cliente'),
    parrafo([
      'La pestaña ', ['Presupuesto Cliente', true],
      ' muestra el R-04 tal como lo verá el cliente: rubros y subrubros con precio de venta, subtotal, IVA y total.',
    ]),
    ...captura('20-comercial-vista-cliente.jpg', 'Vista previa del presupuesto del cliente.'),

    h2('6.8 · Descarga del PDF R-04'),
    parrafo([
      'Con ', ['Descargar R-04', true],
      ' obtiene el PDF del presupuesto, con el encabezado identificado y el detalle por rubro y subrubro. ',
      `Los datos de ${EMPRESA} que aparecen en el encabezado y el pie son los cargados en el menú Empresa.`,
    ]),
    ...captura('24-pdf-r04-pagina1.jpg', 'Primera página del PDF R-04.'),

    h2('6.9 · Envío al cliente'),
    parrafo([
      'Al presionar ', ['Enviar presupuesto al cliente', true], ', el estado del proyecto pasa a ',
      ['Enviado', true], ' y aparece la confirmación “Presupuesto enviado al cliente”. Esto habilita la ' +
      'vista del presupuesto en el portal del cliente.',
    ]),
    ...captura('21-comercial-enviado.jpg', 'Presupuesto enviado al cliente.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 7 ──
    h1('7. Etapa D · El cliente ve el presupuesto y pre-aprueba'),
    parrafo([
      'Portal del cliente · ', ['/mi-proyecto', true],
      '. El cliente vuelve a entrar, encuentra el presupuesto disponible (precio + PDF) y, si quiere ' +
      'avanzar, lo pre-aprueba: eso dispara la coordinación de una reunión por Google Meet.',
    ]),

    h2('7.1 · Presupuesto disponible'),
    parrafo([
      'La línea de tiempo avanzó a ', ['Presupuesto', true], ' y aparece la tarjeta ', ['Tu presupuesto', true],
      ': subtotal sin IVA, precio por m² y total con IVA, más el botón ', ['Descargar PDF', true],
      '. Los valores coinciden exactamente con los que ve el comercial.',
    ]),
    ...captura('23-cliente-portal-presupuesto.jpg', 'Presupuesto disponible en el portal del cliente.'),

    h2('7.2 · Pre-aprobar la oferta'),
    parrafo(['Debajo del presupuesto, el cliente encuentra el botón ', ['Pre-aprobar la oferta', true], ' para avanzar con el proyecto.']),
    ...captura('25-cliente-preaprobar-boton.jpg', 'Botón para pre-aprobar la oferta.'),

    h2('7.3 · Reunión por Google Meet'),
    parrafo([
      'Al pre-aprobar, el estado pasa a ', ['Preaprobado', true], ' y aparece “Oferta pre-aprobada” con el botón ',
      ['Agendar reunión (Google Meet)', true], '. En paralelo, el equipo comercial recibe el aviso por mail para coordinar la reunión.',
    ]),
    ...captura('26-cliente-preaprobado.jpg', 'Oferta pre-aprobada y agenda de la reunión.'),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 8 ──
    h1('8. Etapa E · Cierre de la venta: contrato y orden de producción'),
    parrafo([
      'Lo que se acuerda en la reunión con el cliente (presencial o por Meet) se registra en el ' +
      'proyecto, en la sección ', ['Cierre de la venta', true],
      '. Son tres pasos encadenados: cada uno se habilita cuando terminó el anterior.',
    ]),

    h2('8.1 · Cerrar la venta y emitir el contrato'),
    parrafo([
      'El comercial presiona ', ['Cerrar la venta', true],
      ' y carga lo acordado: plazo de entrega, fecha de inicio, anticipo, forma de pago, lugar de ' +
      'entrega, garantía y condiciones particulares. Con eso se emite el contrato de obra, que ' +
      'recoge el alcance y los importes del presupuesto aprobado.',
    ]),
    nota(
      'El contrato congela el presupuesto',
      'Lo que se firma queda guardado tal como estaba al emitirlo. Si después alguien modifica el ' +
      'presupuesto, el contrato firmado sigue diciendo lo que se firmó. Mientras no esté firmado se ' +
      'pueden corregir las condiciones y se vuelve a emitir.',
      marca,
    ),
    p(''),

    h2('8.2 · La firma'),
    parrafo([
      'El contrato le llega al cliente por mail, en PDF, y puede ', ['firmarlo desde su portal', true],
      ': lee el contrato, escribe su nombre, acepta las condiciones y firma. Queda registrada la ' +
      'fecha, la hora y la cuenta desde la que firmó.',
    ]),
    parrafo([
      'Si prefieren firmarlo en papel, el comercial sube el escaneo con ',
      ['Subir contrato firmado', true],
      ' y queda registrado igual. Sin el archivo no se da por firmado: el respaldo es el documento.',
    ]),

    h2('8.3 · La orden de producción'),
    parrafo([
      'Con el contrato firmado se habilita ', ['Generar orden de producción', true],
      '. La orden sale del contrato firmado (no de un recálculo) y lleva todo lo que oficina técnica ' +
      'necesita: datos de la obra y del cliente, especificaciones técnicas, alcance, despiece por ' +
      'rubro con material y mano de obra, fecha de entrega comprometida y prioridad. Se le manda ' +
      'por mail a oficina técnica con el PDF adjunto.',
    ]),
    nota(
      'Al taller no va nada sin la venta cerrada',
      'La orden de producción no se puede emitir antes de que el contrato esté firmado. No es una ' +
      'convención de la pantalla: el sistema lo rechaza.',
      marca,
    ),
    p(''),
    parrafo([
      'La orden es un ', ['documento interno', true],
      ': muestra los costos de mano de obra, así que el cliente no la ve ni la recibe.',
    ]),
    parrafo([
      'A medida que avanzan estos pasos, el estado del proyecto va cambiando y el cliente lo ve en ' +
      'su portal: ', ['Contrato', true], ' (hay contrato para firmar), ', ['Aprobado', true],
      ' (contrato firmado) y ', ['En producción', true], ' (orden emitida).',
    ]),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 9 ──
    h1('9. Etapa F · Producción: del despiece a la entrega en obra'),
    parrafo([
      'Con la orden de producción emitida aparece, dentro del proyecto, la sección ',
      ['Producción', true],
      '. Es el circuito completo del taller, con un paso por sector y todo lo que pasa anotado en ' +
      'la bitácora. Arriba de todo hay una línea con los seis hitos, para ver de un vistazo dónde ' +
      'está la obra.',
    ]),
    parrafo([
      'En el menú superior, ', ['Producción', true],
      ' abre el tablero de todas las obras. Cada uno ve primero las que están esperando por su ' +
      'sector, y después el resto ordenado por fecha de entrega comprometida.',
    ]),
    nota(
      'La etapa no se elige: se deduce',
      'Nadie marca "ya estoy en fabricación". La etapa sale del estado real de los datos: si falta ' +
      'verificar un material, la obra está en verificación, aunque el taller ya haya empezado otra ' +
      'cosa. Y si aparece un faltante nuevo, la obra vuelve sola a la etapa de compras.',
      marca,
    ),
    p(''),

    h2('9.1 · Despiece de materiales (oficina técnica)'),
    parrafo([
      'Oficina técnica sube la estructura de producto exportada del sistema de gestión, en ',
      ['.xlsx', true], ' o ', ['.csv', true],
      '. El sistema la lee y muestra primero un ', ['resumen de lo que entendió', true],
      ': cuántos renglones de material, cuántos subconjuntos, cómo dedujo el agrupamiento y qué ' +
      'descartó. Recién cuando eso está bien se confirma la importación.',
    ]),
    parrafo([
      'El sistema de gestión exporta ', ['un subconjunto por archivo', true],
      ' —columnas, vigas, correas, escalera, fundaciones—, así que la obra se arma subiendo varios. ' +
      'Cada importación agrega el subconjunto que trae y deja en paz al resto: volver a exportar ' +
      'las vigas después de un cambio no borra las fundaciones. Si el subconjunto ya estaba ' +
      'cargado, lo reemplaza, y el aviso lo dice antes de aplicar.',
    ]),
    parrafo([
      'Si la exportación trae la columna ', ['Stock', true],
      ', el sistema la guarda y la usa como punto de partida de la verificación.',
    ]),
    parrafo([
      'Un subconjunto con material ya ingresado no se puede reemplazar: esos renglones tienen ' +
      'compras hechas detrás.',
    ]),

    h2('9.2 · Verificación de stock (abastecimiento)'),
    parrafo([
      'Abastecimiento carga, renglón por renglón, ', ['cuánto hay en depósito', true],
      '. No es un sí o un no: la disponibilidad parcial es lo normal, y de esa resta sale ' +
      'exactamente cuánto hay que comprar.',
    ]),
    nota(
      'El stock del sistema de gestión viene propuesto, pero hay que confirmarlo',
      'Si la exportación lo traía, cada renglón arranca con esa existencia ya cargada, acotada a ' +
      'lo que hace falta para la obra. Es una ayuda para no tipear cincuenta números, no una ' +
      'verificación: ese stock es general, no está reservado para esta obra y puede estar ' +
      'desactualizado. Al lado de cada renglón se muestra la existencia total para poder compararla.',
      marca,
    ),
    p(''),

    h2('9.3 · Compra de los faltantes'),
    parrafo([
      'Con la verificación hecha, el botón ', ['Generar pedido de materiales', true],
      ' arma el pedido con los faltantes de esta obra, las cantidades que faltan y la fecha en que ' +
      'se necesitan. Sale en PDF para mandárselo a compras.',
    ]),
    nota(
      'Es un pedido de referencia, no la orden de compra del ERP',
      'La plataforma no maneja precios ni proveedores: eso lo negocia compras en el sistema de ' +
      'gestión. Lo que sí hace es seguir el pedido, para que nadie tenga que preguntar por teléfono ' +
      'en qué quedó. Al cursarlo se anota el número del ERP y queda vinculado.',
      marca,
    ),
    p(''),

    h2('9.4 · Ingreso de materiales'),
    parrafo([
      'Cada vez que llega mercadería, abastecimiento registra el ingreso con el remito del ' +
      'proveedor. Los ingresos ', ['se suman', true],
      ': si el acero entra en tres viajes, se cargan los tres y el renglón queda completo recién ' +
      'con el último.',
    ]),

    h2('9.5 · Fabricación (taller)'),
    parrafo([
      'Oficina técnica define qué se fabrica —por defecto, una parte por subconjunto del despiece, ' +
      'que es como está organizada la estructura— y el taller las va moviendo: pendiente, en ' +
      'fabricación, terminada.',
    ]),
    nota(
      'El taller no arranca con material sin resolver',
      'Si queda algún renglón sin stock y sin recibir, el sistema no deja marcar una parte como ' +
      'empezada. Es la regla que evita que una parte quede a medias esperando el acero.',
      marca,
    ),
    p(''),

    h2('9.6 · Despacho a obra'),
    parrafo([
      'Logística arma el remito con las partes terminadas, con transporte, chofer, patente y ' +
      'destino. Una nave sale en varios viajes, así que se pueden hacer todos los remitos que haga ' +
      'falta; cada parte sólo se puede despachar una vez.',
    ]),
    parrafo([
      'El remito sale en PDF con el detalle de lo que viaja y el espacio para la firma de quien ' +
      'recibe, para que vaya impreso con el camión.',
    ]),

    h2('9.7 · Control de llegada a la obra'),
    parrafo([
      'Cuando el camión llega, se registra quién recibió, cuándo y en qué estado: conforme, con ' +
      'observaciones o rechazado. Si no llegó conforme, hay que decir qué pasó: sin eso no se ' +
      'guarda.',
    ]),
    nota(
      'Un despacho no se da por entregado hasta que la obra lo confirma',
      'Es el único dato del circuito que aporta el destino y no quien despachó. Mientras falte una ' +
      'confirmación, la orden no se puede cerrar.',
      marca,
    ),
    p(''),

    h2('9.8 · Cierre y trazabilidad'),
    parrafo([
      'Con todo entregado y confirmado, oficina técnica cierra la orden. La ', ['bitácora', true],
      ' queda guardada con cada movimiento: qué sector lo hizo, qué hizo, cuándo y con qué nombre. ' +
      'Es lo que permite contestar, meses después, por qué una obra se demoró.',
    ]),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 10 ──
    h1('10. Notificaciones automáticas por email'),
    parrafo([
      'Desde que el cliente deja su email, la plataforma avisa en los momentos clave. No hay que ' +
      'hacer nada: salen solas.',
    ]),
    tabla(
      ['Momento', 'Destinatario', 'Contenido'],
      [
        ['El cliente registra su consulta', 'Cliente', 'Bienvenida con el código del proyecto, el enlace al portal y el enlace para confirmar el email.'],
        ['El cliente registra su consulta', 'Equipo comercial', 'Aviso de que hay una cotización nueva a la espera de revisión.'],
        ['El comercial envía el presupuesto', 'Cliente', 'Enlace a la plataforma y el PDF R-04 adjunto, invitándolo a pre-aprobar.'],
        ['El cliente pre-aprueba', 'Equipo comercial y cliente', 'Dispara la reunión: invitación de Google Calendar con enlace de Google Meet, y confirmación al cliente.'],
        ['Se emite el contrato', 'Cliente', 'El contrato en PDF, con el enlace al portal para firmarlo.'],
        ['Se firma el contrato', 'Equipo comercial y cliente', 'Aviso de que ya se puede emitir la orden de producción, y confirmación al cliente.'],
        ['Se emite la orden de producción', 'Oficina técnica', 'La orden en PDF, con el despiece y la fecha de entrega comprometida.'],
        ['La obra pasa a una etapa nueva', 'El sector que tiene que mover', 'Aviso de que la obra lo está esperando, con el enlace para abrirla.'],
      ],
      [2700, 1900, 5038],
      marca,
    ),
    p(''),
    nota(
      'Si los correos no llegan',
      'Las notificaciones necesitan el proveedor de correo configurado en el servidor. Si no lo está, ' +
      'la plataforma funciona igual y los envíos quedan registrados en el log, pero el cliente no ' +
      'recibe nada: avisale al responsable técnico.',
      marca,
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 11 ──
    h1('11. Mantenimiento del catálogo y los parámetros'),
    parrafo([
      'El presupuesto sale tan bien como los datos que lo alimentan. Tres menús, todos del rol ', ['admin', true], ':',
    ]),
    vineta([['Ratios. ', true], 'Los rendimientos y consumos por m² que usa el motor Base 0 para estimar cantidades.']),
    vineta([['Parámetros. ', true], 'Los porcentajes de la cascada de costeo: gastos indirectos, beneficio, IVA.']),
    vineta([['Precios. ', true], 'La biblioteca de precios de referencia (materiales y mano de obra).']),
    vineta([['Importar Base 0. ', true], 'Carga masiva del catálogo desde una planilla, para la puesta en marcha o una actualización grande.']),
    p(''),
    nota(
      'Conviene revisar los precios con una frecuencia fija',
      'Un catálogo desactualizado no da error: da un presupuesto equivocado. Fijar una revisión ' +
      'mensual del tipo de cambio y de los precios de referencia evita cotizar por debajo del costo.',
      marca,
    ),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 10 ──
    h1('12. Preguntas frecuentes'),
    ...[
      ['El cliente no ve su presupuesto en el portal.',
       'Dos causas posibles: el comercial todavía no presionó “Enviar presupuesto al cliente”, o el ' +
       'cliente no confirmó su email. Lo segundo se reconoce porque el portal le muestra el aviso.'],
      ['El precio del asistente no coincide con el del presupuesto final.',
       'Es esperable. El del asistente es un precio orientativo en vivo; el definitivo lo calcula el ' +
       'motor Base 0 con el catálogo completo y puede ajustarlo el comercial.'],
      ['Hay que modificar un presupuesto ya enviado.',
       'Se modifica igual, desde la pestaña Presupuesto Base 0, y se vuelve a enviar. El cliente ve ' +
       'siempre la última versión.'],
      ['El logo o los datos salen mal en el PDF.',
       'Se corrigen en el menú Empresa. El presupuesto toma los datos en el momento de generarse, ' +
       'así que alcanza con volver a descargarlo.'],
      ['Un cliente perdió su contraseña.',
       'Puede recuperarla desde la pantalla de ingreso del portal.'],
      ['Entró una consulta que no corresponde.',
       'Se deja en estado Borrador y no se envía. Los proyectos sin enviar no son visibles para el cliente.'],
    ].flatMap(([pregunta, respuesta]) => [
      parrafo([[pregunta, true]], { spacing: { before: 160, after: 60 } }),
      parrafo([respuesta]),
    ]),
    new Paragraph({ children: [new PageBreak()] }),

    // ── 11 ──
    h1('13. Datos de la empresa'),
    parrafo(['Los datos cargados en la plataforma, tal como se imprimen en el presupuesto:']),
    tabla(
      ['Dato', 'Valor'],
      [
        ['Nombre comercial', marca.nombre || '—'],
        ['Razón social', marca.razonSocial || '—'],
        ['CUIT', marca.cuit || '—'],
        ['Domicilio', [marca.domicilio, marca.localidad, marca.provincia].filter(Boolean).join(', ') || '—'],
        ['Teléfono', marca.telefono || '—'],
        ['Email', marca.email || '—'],
        ['Sitio web', marca.web || '—'],
      ],
      [3000, 6638],
      marca,
    ),
    p(''),
    parrafo([
      'Si alguno está vacío o desactualizado, se corrige desde el menú ', ['Empresa', true],
      ' y se vuelve a generar este manual.',
    ], { spacing: { before: 120 } }),
  ]

  // Encabezado y pie (no se aplican a la portada: titlePage los separa)
  const encabezado = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D9D9D9', space: 6 } },
        children: marca.logo
          ? [new ImageRun({
              data: marca.logo.datos,
              type: marca.logo.tipo,
              transformation: encajar(marca.logo.datos, 95, 30),
            })]
          : [new TextRun({ text: EMPRESA, bold: true, size: 18, color: INK, font: 'Calibri' })],
      }),
    ],
  })

  const pie = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `Manual de operaciones · ${EMPRESA} · `, size: 16, color: '909090', font: 'Calibri' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '909090', font: 'Calibri' }),
        ],
      }),
    ],
  })

  return new Document({
    creator: EMPRESA,
    title: `Manual de operaciones — ${EMPRESA}`,
    description: 'Manual de operaciones de la plataforma de cotización.',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 21, color: '404040' } },
        title: {
          run: { font: 'Calibri', size: 52, bold: true, color: INK },
          paragraph: { spacing: { before: 0, after: 200 }, keepNext: true },
        },
        heading1: {
          run: { font: 'Calibri', size: 32, bold: true, color: INK },
          paragraph: { spacing: { before: 280, after: 160 }, keepNext: true },
        },
        heading2: {
          run: { font: 'Calibri', size: 24, bold: true, color: PRIMARIO },
          paragraph: { spacing: { before: 260, after: 120 }, keepNext: true },
        },
      },
    },
    numbering: {
      config: [{
        reference: 'vinetas',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 240 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        titlePage: true, // la portada no lleva encabezado ni pie
        page: {
          margin: {
            top: convertInchesToTwip(0.9),
            bottom: convertInchesToTwip(0.9),
            left: convertInchesToTwip(0.79),
            right: convertInchesToTwip(0.79),
          },
        },
      },
      headers: { default: encabezado, first: new Header({ children: [new Paragraph('')] }) },
      footers: { default: pie, first: new Footer({ children: [new Paragraph('')] }) },
      children: [...portada, ...indice, ...cuerpo],
    }],
  })
}

// ─── Salida ────────────────────────────────────────────────────

const marca = await resolverMarca()
const doc = construir(marca)

const salida = resolve(
  process.cwd(),
  args.salida ||
    join(AQUI, `Manual-Operaciones-${(args.slug || marca.nombre).replace(/[^\w\-]+/g, '-')}.docx`),
)

writeFileSync(salida, await Packer.toBuffer(doc))
console.log(`Manual generado: ${salida}`)
console.log(`Empresa: ${marca.nombre}${marca.logo ? ' (con logo)' : ' (sin logo: se usa el nombre en texto)'}`)
