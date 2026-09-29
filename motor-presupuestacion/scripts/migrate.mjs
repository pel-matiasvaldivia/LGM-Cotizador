// Corre las migraciones SQL de ./drizzle en orden y hace el seed inicial.
// Se ejecuta en el arranque del contenedor, antes de `node server.js`.
// Solo depende de `pg` (presente en el bundle standalone de Next).
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'
import { createRequire } from 'node:module'
import { sembrarParametros } from './lib/semilla.mjs'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle')

// Mismo formato que src/lib/password.ts — mantener en sincronía
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

async function main() {
  // Preferir PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT (sin URL: cualquier
  // contraseña vale). DATABASE_URL queda como alternativa.
  let pool
  if (process.env.PGHOST) {
    pool = new Pool()
  } else if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  } else {
    console.error('[migrate] configurar PGHOST/PGUSER/PGPASSWORD/PGDATABASE (o DATABASE_URL)')
    process.exit(1)
  }

  // Esperar a que Postgres acepte conexiones (arranque en frío de docker compose)
  for (let i = 0; ; i++) {
    try {
      await pool.query('SELECT 1')
      break
    } catch (err) {
      // Errores de configuración: no tiene sentido reintentar
      if (err.code === 'ERR_INVALID_URL') {
        console.error('[migrate] DATABASE_URL inválida (¿contraseña con caracteres especiales?). Usar PGHOST/PGUSER/PGPASSWORD/PGDATABASE en su lugar.')
        process.exit(1)
      }
      if (err.code === '28P01' || err.code === '28000') {
        console.error('[migrate] autenticación rechazada por Postgres: revisar usuario/contraseña')
        process.exit(1)
      }
      if (i >= 30) throw err
      console.log(`[migrate] esperando a Postgres... (${i + 1}: ${err.message})`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file])
    if (rows.length > 0) continue

    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const statements = sql.split('--> statement-breakpoint')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const stmt of statements) {
        if (stmt.trim()) await client.query(stmt)
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`[migrate] aplicada ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`[migrate] falló ${file}:`, err.message)
      process.exit(1)
    } finally {
      client.release()
    }
  }

  // Multi-tenant: primero la empresa (de ella cuelgan usuarios, catálogo y
  // parámetros), y después los seeds, siempre acotados a ese tenant.
  const tenantId = await bootstrapTenant(pool)
  await seedAdmin(pool, tenantId)
  await seedCatalogo(pool, tenantId)
  await seedPreciosReferencia(pool, tenantId)
  await seedParametros(pool, tenantId)
  await pool.end()
  console.log('[migrate] listo')
}

// ─── Tenant por defecto ─────────────────────────────────────────
// La empresa del despliegue tiene que existir antes que cualquier otro dato.
// Sus valores iniciales salen de la config de archivo (config/brands/<BRAND>.json
// + variables BRAND_*), y de ahí en adelante la fuente de verdad es la base:
// el panel (Configuración → Empresa) sólo escribe ahí.
//
// Es idempotente y NO pisa lo que ya se editó desde el panel: sólo completa los
// campos que siguen vacíos.
function leerPresetMarca() {
  const slug = (process.env.BRAND || 'default').trim() || 'default'
  let preset = {}
  if (/^[a-z0-9._-]+$/i.test(slug)) {
    const dir = process.env.BRAND_CONFIG_DIR || path.join(process.cwd(), 'config', 'brands')
    try {
      preset = JSON.parse(readFileSync(path.join(dir, `${slug}.json`), 'utf8'))
    } catch {
      // Sin preset: se arranca con la marca neutra y se configura desde el panel.
    }
  }
  if (process.env.BRAND_CONFIG_FILE) {
    try {
      preset = { ...preset, ...JSON.parse(readFileSync(process.env.BRAND_CONFIG_FILE, 'utf8')) }
    } catch (e) {
      console.warn(`[bootstrap] no se pudo leer BRAND_CONFIG_FILE: ${e.message}`)
    }
  }
  return { slug, preset }
}

// Bloques de texto de la landing que viven en el jsonb `landing` del tenant.
const CLAVES_LANDING = [
  'meta', 'hero', 'servicios', 'nosotros', 'clientes', 'contacto', 'ctaFinal',
  'footerNota', 'logo', 'logoOscuro',
]

async function bootstrapTenant(pool) {
  const { slug, preset } = leerPresetMarca()
  const env = process.env
  const contacto = preset.contacto || {}
  const fiscal = preset.fiscal || {}
  const theme = preset.theme || {}

  const datos = {
    nombre: env.BRAND_NOMBRE || preset.nombre || 'Mi Empresa',
    razon_social: env.BRAND_RAZON_SOCIAL || preset.razonSocial || '',
    tagline: env.BRAND_TAGLINE || preset.tagline || '',
    cuit: env.BRAND_CUIT || fiscal.cuit || '',
    condicion_iva: env.BRAND_CONDICION_IVA || fiscal.condicionIva || '',
    ingresos_brutos: env.BRAND_INGRESOS_BRUTOS || fiscal.ingresosBrutos || '',
    inicio_actividades: env.BRAND_INICIO_ACTIVIDADES || fiscal.inicioActividades || '',
    domicilio: env.BRAND_DOMICILIO || contacto.domicilio || '',
    localidad: env.BRAND_LOCALIDAD || contacto.localidad || '',
    provincia: env.BRAND_PROVINCIA || contacto.provincia || '',
    codigo_postal: env.BRAND_CODIGO_POSTAL || contacto.codigoPostal || '',
    telefono: env.BRAND_TELEFONO || contacto.telefono || '',
    email: env.BRAND_EMAIL || contacto.email || '',
    web: env.BRAND_WEB || contacto.web || '',
    whatsapp: env.BRAND_WHATSAPP || contacto.whatsapp || '',
    color_primario: (env.BRAND_COLOR_PRIMARY || theme.primary || '').toLowerCase(),
    color_ink: (env.BRAND_COLOR_INK || theme.ink || '').toLowerCase(),
    color_surface: (env.BRAND_COLOR_SURFACE || theme.surface || '').toLowerCase(),
  }

  // Textos de la landing del preset: se copian a la base para que la identidad
  // quede completa ahí y una empresa nueva no herede la de esta.
  const landing = {}
  for (const clave of CLAVES_LANDING) {
    if (preset[clave] !== undefined) landing[clave] = preset[clave]
  }
  if (env.BRAND_LOGO) landing.logo = env.BRAND_LOGO
  if (env.BRAND_LOGO_OSCURO) landing.logoOscuro = env.BRAND_LOGO_OSCURO

  // Adopción del tenant que creó la migración: si hay uno solo, con el slug
  // provisorio, pasa a ser el de este despliegue (se queda con todos los datos
  // que ya había en la base).
  const { rows: existentes } = await pool.query('SELECT id, slug FROM tenants ORDER BY created_at')
  if (existentes.length === 1 && existentes[0].slug === 'default' && slug !== 'default') {
    await pool.query('UPDATE tenants SET slug = $1 WHERE id = $2', [slug, existentes[0].id])
    console.log(`[bootstrap] la empresa existente pasa a ser "${slug}"`)
  }

  const { rows: [tenant] } = await pool.query(
    `INSERT INTO tenants (slug, nombre) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id, nombre`,
    [slug, datos.nombre],
  )

  // Sólo completa lo que está vacío: nunca pisa lo editado desde el panel.
  const sets = []
  const valores = [tenant.id]
  for (const [columna, valor] of Object.entries(datos)) {
    if (!valor) continue
    valores.push(valor)
    const marcador = `$${valores.length}`
    sets.push(columna === 'nombre'
      ? `nombre = CASE WHEN nombre IN ('', 'Mi Empresa') THEN ${marcador} ELSE nombre END`
      : `${columna} = CASE WHEN ${columna} = '' THEN ${marcador} ELSE ${columna} END`)
  }
  if (Object.keys(landing).length > 0) {
    valores.push(JSON.stringify(landing))
    sets.push(`landing = CASE WHEN landing = '{}'::jsonb THEN $${valores.length}::jsonb ELSE landing END`)
  }
  if (sets.length > 0) {
    await pool.query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = $1`, valores)
  }

  // Dominios del tenant (coma-separados). Se agregan; no se borran los que ya
  // estén, para no dejar un despliegue sin ruta de entrada por un typo.
  const dominios = [...new Set((env.TENANT_DOMINIOS || env.BRAND_DOMINIOS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, ''))
    .filter(Boolean))]
  for (const dominio of dominios) {
    await pool.query(
      `INSERT INTO tenant_dominios (dominio, tenant_id) VALUES ($1, $2)
       ON CONFLICT (dominio) DO UPDATE SET tenant_id = EXCLUDED.tenant_id`,
      [dominio, tenant.id],
    )
  }
  if (dominios.length) console.log(`[bootstrap] dominios de "${slug}": ${dominios.join(', ')}`)

  console.log(`[bootstrap] empresa "${slug}" lista (${tenant.id})`)
  return tenant.id
}

// Garantiza que el usuario admin maestro exista en cada arranque (idempotente).
// Si el email ya existe NO se toca su contraseña (puede haberse cambiado desde
// el panel). Si falta, se crea. Override con ADMIN_EMAIL / ADMIN_PASSWORD.
// Con ADMIN_FORCE_RESET=true, además resetea su contraseña al valor de env.
async function seedAdmin(pool, tenantId) {
  const email = (process.env.ADMIN_EMAIL || 'admin@logmetal.com.ar').toLowerCase()
  const password = process.env.ADMIN_PASSWORD || 'L4gm2t1l_2026'

  const { rows } = await pool.query(
    'SELECT id FROM usuarios WHERE tenant_id = $1 AND email = $2', [tenantId, email])
  if (rows.length > 0) {
    // El admin maestro es, por definición, quien administra la plataforma.
    await pool.query(
      'UPDATE usuarios SET superadmin = true WHERE id = $1 AND superadmin = false',
      [rows[0].id])
    if (process.env.ADMIN_FORCE_RESET === 'true') {
      await pool.query(
        `UPDATE usuarios SET password_hash = $3, rol = 'admin' WHERE tenant_id = $1 AND email = $2`,
        [tenantId, email, hashPassword(password)],
      )
      console.log(`[seed] contraseña del admin maestro reseteada (ADMIN_FORCE_RESET): ${email}`)
    }
    return
  }

  await pool.query(
    `INSERT INTO usuarios (tenant_id, email, password_hash, nombre, rol, superadmin)
     VALUES ($1, $2, $3, $4, 'admin', true)`,
    [tenantId, email, hashPassword(password), 'Administrador']
  )
  console.log(`[seed] usuario admin maestro creado: ${email}`)
}

// Catálogo inicial de rubros/subrubros/ratios. Valores por m² calibrados a
// partir de un presupuesto Base 0 real (ajustables desde /configuracion/ratios).
// Cada rubro: [nombre, codigoFlexxusRubro, subMaterial, [subrubros...]]
// Cada subrubro: [nombre, unidad, ratioCantidad, materialUsd, moUsd]
async function seedCatalogo(pool, tenantId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM rubros WHERE tenant_id = $1', [tenantId])
  if (rows[0].n > 0) return

  const catalogo = [
    ['Honorarios', 46, 333, [
      ['Honorarios y dirección de obra', 'm2', 1, 0, 13.1],
    ]],
    ['Preliminares', 47, 339, [
      ['Obrador, replanteo y varios', 'm2', 1, 0, 0.85],
    ]],
    ['Movimiento de Suelo', 48, 343, [
      ['Excavación, relleno y compactación', 'm2', 1, 7.62, 4.47],
    ]],
    ['Fundaciones', 49, 346, [
      ['Hormigón, hierros y pilotes', 'm2', 1, 7.7, 7.78],
    ]],
    ['Estructura Metálica', 50, 349, [
      ['Estructura Alveolar', 'm2', 1, 15.0, 30.0],
      ['Estructura Alma Llena', 'm2', 1, 19.4, 34.1],
      ['Estructura Reticulada', 'm2', 1, 13.0, 26.0],
    ]],
    ['Escaleras', 54, 360, [
      ['Escalera metálica', 'global', 1, 1955, 2546],
    ]],
    ['Cerramiento Lateral', 51, 352, [
      ['Cerramiento Lateral Chapa', 'm2', 1, 17.7, 4.4],
    ]],
    ['Cerramiento Cubierta', 52, 354, [
      ['Cubierta Chapa Trapezoidal', 'm2', 1, 24.3, 6.5],
      ['Cubierta Panel Sandwich', 'm2', 1, 40.0, 6.5],
    ]],
    ['Zinguería', 56, 366, [
      ['Zinguería y babetas', 'm2', 1, 0.3, 0.77],
    ]],
    ['Portones', 53, 357, [
      ['Portón Corredizo Metálico', 'uni', 1, 1500, 350],
    ]],
    ['Piso Industrial', 58, 371, [
      ['Piso Hormigón H-25 c/cuarzo', 'm2', 1, 20.1, 5.11],
    ]],
    ['Veredín', 59, 373, [
      ['Veredín perimetral H-25', 'm2', 1, 1.76, 1.45],
    ]],
    // Rubros del módulo "oficina interior" (Tabiques, Revestimientos, Obra Civil).
    // Sus m² escalan con el área de la oficina, no con la superficie de nave.
    ['Tabiques Livianos y Cielorraso', 60, 375, [
      ['Tabique y cielorraso interior', 'm2', 1, 15.0, 12.0],
    ]],
    ['Revestimientos', 62, 379, [
      ['Revestimientos y pisos de oficina', 'm2', 1, 22.0, 10.0],
    ]],
    ['Obra Civil', 67, 391, [
      ['Losa/entrepiso y mampostería', 'm2', 1, 25.0, 22.0],
    ]],
    ['Instalación Eléctrica', 64, 384, [
      ['Instalación Eléctrica Nave', 'm2', 1, 9.5, 0],
    ]],
    // Baño interior: costeo por artefactos, escala con la cantidad de baños.
    ['Instalación Sanitaria', 63, 380, [
      ['Baño completo (artefactos + instalación)', 'bano', 1, 900, 300],
    ]],
    ['Montaje', 50, 348, [
      ['Montaje en Obra', 'm2', 1, 0, 20.0],
    ]],
    ['Final de Obra', 70, 399, [
      ['Limpieza final y puesta en marcha', 'm2', 1, 0, 1.9],
    ]],
  ]

  const tipoCambio = Number(process.env.TIPO_CAMBIO_INICIAL || 1050)
  let ordenRubro = 1
  for (const [rubroNombre, codigoRubro, subMaterial, items] of catalogo) {
    const { rows: [rubro] } = await pool.query(
      'INSERT INTO rubros (tenant_id, nombre, orden, codigo_flexxus) VALUES ($1, $2, $3, $4) RETURNING id',
      [tenantId, rubroNombre, ordenRubro++, codigoRubro]
    )
    for (const [subNombre, unidad, ratio, material, mo] of items) {
      const { rows: [sub] } = await pool.query(
        'INSERT INTO subrubros (rubro_id, nombre, codigo_flexxus) VALUES ($1, $2, $3) RETURNING id',
        [rubro.id, subNombre, subMaterial]
      )
      const total = material + mo
      await pool.query(
        `INSERT INTO ratios_costos
           (subrubro_id, unidad, ratio_cantidad, precio_material_usd, precio_mo_usd, precio_unitario_usd, precio_unitario_ars)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sub.id, unidad, ratio, material, mo, total, total * tipoCambio]
      )
    }
  }
  console.log('[seed] catálogo de rubros/ratios inicial creado (calibrado, con material/MO y códigos Flexxus)')
}

// Biblioteca de precios de referencia (Revista Cifras). Se siembra desde
// scripts/precios-referencia.json (extraído de la hoja de costos unitarios).
// Upsert idempotente por (codigo, descripcion): re-ejecutar actualiza precios
// sin duplicar. Sólo corre si el JSON está presente.
async function seedPreciosReferencia(pool, tenantId) {
  let datos
  try {
    const raw = readFileSync(path.join(process.cwd(), 'scripts', 'precios-referencia.json'), 'utf8')
    datos = JSON.parse(raw)
  } catch {
    console.log('[seed] precios-referencia.json ausente, se omite la biblioteca de precios')
    return
  }
  if (!Array.isArray(datos) || datos.length === 0) return

  let insertados = 0
  for (const it of datos) {
    const total = Number(it.costoTotalUsd) || (Number(it.costoMaterialUsd) || 0) + (Number(it.costoEjecucionUsd) || 0)
    await pool.query(
      `INSERT INTO precios_referencia
         (tenant_id, categoria, codigo, descripcion, unidad, costo_material_usd, costo_ejecucion_usd, costo_total_usd, fuente)
       VALUES ($8, $1, $2, $3, $4, $5, $6, $7, 'Revista Cifras')
       ON CONFLICT (tenant_id, codigo, descripcion) DO UPDATE SET
         categoria = EXCLUDED.categoria,
         unidad = EXCLUDED.unidad,
         costo_material_usd = EXCLUDED.costo_material_usd,
         costo_ejecucion_usd = EXCLUDED.costo_ejecucion_usd,
         costo_total_usd = EXCLUDED.costo_total_usd,
         updated_at = now()`,
      [
        it.categoria || '', it.codigo || '', it.descripcion, it.unidad || '',
        Number(it.costoMaterialUsd) || 0, Number(it.costoEjecucionUsd) || 0, total,
        tenantId,
      ],
    )
    insertados++
  }
  console.log(`[seed] biblioteca de precios de referencia: ${insertados} ítems (upsert)`)
}

// Parámetros de costeo de la empresa del despliegue. Los valores son los del
// módulo compartido con el panel y con scripts/tenant.mjs; se insertan sólo si
// faltan, así no pisan lo ya configurado.
async function seedParametros(pool, tenantId) {
  const insertados = await sembrarParametros(
    (text, params) => pool.query(text, params),
    tenantId,
  )
  console.log(`[seed] parámetros de costeo: ${insertados} clave(s) inicializada(s)`)
}

main().catch((err) => {
  console.error('[migrate] error fatal:', err)
  process.exit(1)
})
