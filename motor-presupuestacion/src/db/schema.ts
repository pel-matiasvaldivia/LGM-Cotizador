import {
  pgTable, uuid, text, boolean, integer, doublePrecision, timestamp, jsonb, uniqueIndex, index,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// Los cuatro sectores que intervienen en el circuito de producción.
export const SECTORES = ['oficina_tecnica', 'abastecimiento', 'taller', 'logistica'] as const
export type Sector = (typeof SECTORES)[number]

// ─── Tenants (multi-empresa por dominio) ───────────────────────
// Cada empresa que contrata el servicio es un tenant: se resuelve por el Host
// del request (ver src/lib/tenant.ts) y de acá sale su identidad visible y sus
// datos fiscales, que son los que se imprimen en el presupuesto.

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull(),
  activo: boolean('activo').notNull().default(true),

  // Identidad
  nombre: text('nombre').notNull(),
  razonSocial: text('razon_social').notNull().default(''),
  tagline: text('tagline').notNull().default(''),

  // Datos fiscales (encabezado y pie del presupuesto)
  cuit: text('cuit').notNull().default(''),
  condicionIva: text('condicion_iva').notNull().default(''),
  ingresosBrutos: text('ingresos_brutos').notNull().default(''),
  inicioActividades: text('inicio_actividades').notNull().default(''),

  // Domicilio legal / comercial
  domicilio: text('domicilio').notNull().default(''),
  localidad: text('localidad').notNull().default(''),
  provincia: text('provincia').notNull().default(''),
  codigoPostal: text('codigo_postal').notNull().default(''),

  // Contacto
  telefono: text('telefono').notNull().default(''),
  email: text('email').notNull().default(''),
  web: text('web').notNull().default(''),
  whatsapp: text('whatsapp').notNull().default(''),

  // Identidad visual. Los logos se guardan inline (como los documentos de
  // proyecto) para no depender de un blob store ni de volúmenes por tenant.
  colorPrimario: text('color_primario').notNull().default(''),
  colorInk: text('color_ink').notNull().default(''),
  colorSurface: text('color_surface').notNull().default(''),
  logoMime: text('logo_mime'),
  logoBase64: text('logo_base64'),
  logoOscuroMime: text('logo_oscuro_mime'),
  logoOscuroBase64: text('logo_oscuro_base64'),
  logoAlto: integer('logo_alto').notNull().default(48),

  // Cotizador público: si el visitante ve el precio orientativo mientras arma
  // la nave. Apagarlo es una decisión comercial (no mostrar números antes de
  // que los revise un comercial), no un problema de cálculo.
  mostrarPrecioEstimado: boolean('mostrar_precio_estimado').notNull().default(true),

  // Textos de la landing (bloques opcionales; lo que falte cae a los defaults
  // de la config de archivo). Ver BrandLanding en src/lib/branding.ts.
  landing: jsonb('landing').notNull().default(sql`'{}'::jsonb`),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('tenants_slug_idx').on(t.slug)])

// Dominios que resuelven a cada tenant. Es configuración de plataforma (no la
// edita el admin del tenant): se administra con scripts/tenant.mjs.
export const tenantDominios = pgTable('tenant_dominios', {
  dominio: text('dominio').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('tenant_dominios_tenant_idx').on(t.tenantId)])

// ─── Auth ──────────────────────────────────────────────────────

export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  nombre: text('nombre').notNull().default(''),
  rol: text('rol', { enum: ['admin', 'comercial', 'cliente'] }).notNull().default('cliente'),
  // Sectores del circuito de producción a los que pertenece. El rol decide a
  // qué parte del sistema entra; el sector, qué pasos del circuito puede dar.
  // Una misma persona puede estar en varios: en una PyME quien compra recibe.
  sectores: jsonb('sectores').$type<Sector[]>().notNull().default(sql`'[]'::jsonb`),
  // Administrador de la PLATAFORMA: da de alta empresas, les asigna dominios y
  // les crea su primer admin. Es ortogonal a `rol`, que es el rol dentro de la
  // empresa por la que el usuario entra.
  superadmin: boolean('superadmin').notNull().default(false),
  // Verificación del email (sólo aplica a las cuentas de cliente, que son las
  // que se registran solas). Sin verificar no se ven presupuestos.
  emailVerificadoAt: timestamp('email_verificado_at', { withTimezone: true }),
  verificacionTokenHash: text('verificacion_token_hash'),
  verificacionExpira: timestamp('verificacion_expira', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // El mismo email puede existir en dos empresas distintas: la unicidad es
  // por tenant, no global.
}, (t) => [uniqueIndex('usuarios_tenant_email_idx').on(t.tenantId, t.email)])

export const sesiones = pgTable('sesiones', {
  // sha256 del token que viaja en la cookie; el token en claro nunca se persiste
  tokenHash: text('token_hash').primaryKey(),
  usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sesiones_usuario_idx').on(t.usuarioId)])

// ─── Catálogo de costos ────────────────────────────────────────

export const rubros = pgTable('rubros', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  codigoFlexxus: integer('codigo_flexxus').notNull().default(0),
  orden: integer('orden').notNull().default(0),
}, (t) => [index('rubros_tenant_idx').on(t.tenantId)])

export const subrubros = pgTable('subrubros', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  rubroId: uuid('rubro_id').notNull().references(() => rubros.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  codigoFlexxus: integer('codigo_flexxus').notNull().default(0),
})

export const ratiosCostos = pgTable('ratios_costos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  subrubroId: uuid('subrubro_id').notNull().references(() => subrubros.id, { onDelete: 'cascade' }),
  unidad: text('unidad').notNull(),
  ratioCantidad: doublePrecision('ratio_cantidad').notNull().default(0),
  // Costo unitario desglosado (USD): material y mano de obra (fabricación + montaje)
  precioMaterialUsd: doublePrecision('precio_material_usd').notNull().default(0),
  precioMoUsd: doublePrecision('precio_mo_usd').notNull().default(0),
  // Desglose real de la MO (Base 0): fabricación y montaje por separado.
  // precioMoUsd se mantiene como la suma (compatibilidad con el costeo actual).
  precioMoFabUsd: doublePrecision('precio_mo_fab_usd').notNull().default(0),
  precioMoMontajeUsd: doublePrecision('precio_mo_montaje_usd').notNull().default(0),
  // Total (= material + mo). Se mantiene por compatibilidad con la UI existente.
  precioUnitarioArs: doublePrecision('precio_unitario_ars').notNull().default(0),
  precioUnitarioUsd: doublePrecision('precio_unitario_usd').notNull().default(0),
  vigente: boolean('vigente').notNull().default(true),
  fechaActualizacion: timestamp('fecha_actualizacion', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Proyectos ─────────────────────────────────────────────────

export const proyectos = pgTable('proyectos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  codigo: text('codigo').notNull(),
  cliente: text('cliente').notNull(),
  razonSocial: text('razon_social'),
  contacto: text('contacto'),
  dni: text('dni'),
  telefono: text('telefono'),
  email: text('email'),
  ubicacion: text('ubicacion'),
  canalOrigen: text('canal_origen').notNull().default('manual'),
  // Ciclo de vida completo, de la consulta al taller:
  //   borrador → enviado → preaprobado → contrato → aprobado → produccion
  // 'contrato' es el contrato emitido esperando firma; 'aprobado' es el
  // contrato ya firmado; 'produccion' es con la orden emitida.
  estado: text('estado', {
    enum: ['borrador', 'enviado', 'preaprobado', 'contrato', 'aprobado', 'produccion'],
  }).notNull().default('borrador'),
  observaciones: text('observaciones'),
  // Códigos para la exportación a Flexxus (se asignan al exportar)
  codigoProyectoFlexxus: integer('codigo_proyecto_flexxus'),
  codigoClienteFlexxus: text('codigo_cliente_flexxus'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('proyectos_tenant_codigo_idx').on(t.tenantId, t.codigo),
  index('proyectos_tenant_email_idx').on(t.tenantId, t.email),
])

export const datosTecnicos = pgTable('datos_tecnicos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  ancho: doublePrecision('ancho'),
  largo: doublePrecision('largo'),
  superficie: doublePrecision('superficie'),
  alturaLibre: doublePrecision('altura_libre'),
  distanciaObraKm: doublePrecision('distancia_obra_km'),
  tipologia: text('tipologia'),
  tipoCubierta: text('tipo_cubierta'),
  tipoCerramiento: text('tipo_cerramiento'),
  incluyeFabricacion: boolean('incluye_fabricacion').notNull().default(true),
  incluyeMontaje: boolean('incluye_montaje').notNull().default(true),
  incluyeCubierta: boolean('incluye_cubierta').notNull().default(true),
  incluyeCerramientoLateral: boolean('incluye_cerramiento_lateral').notNull().default(false),
  incluyePortones: boolean('incluye_portones').notNull().default(false),
  incluyePiso: boolean('incluye_piso').notNull().default(false),
  incluyeElectrica: boolean('incluye_electrica').notNull().default(false),
  incluyeSanitaria: boolean('incluye_sanitaria').notNull().default(false),
  cantidadPortones: integer('cantidad_portones'),
  especificacionesAdicionales: text('especificaciones_adicionales'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('datos_tecnicos_proyecto_idx').on(t.proyectoId)])

export const presupuestoBaseItems = pgTable('presupuesto_base_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  rubroId: uuid('rubro_id').references(() => rubros.id, { onDelete: 'set null' }),
  subrubroId: uuid('subrubro_id').references(() => subrubros.id, { onDelete: 'set null' }),
  descripcion: text('descripcion').notNull().default(''),
  unidad: text('unidad').notNull().default(''),
  cantidad: doublePrecision('cantidad').notNull().default(0),
  precioUnitarioArs: doublePrecision('precio_unitario_ars').notNull().default(0),
  precioUnitarioUsd: doublePrecision('precio_unitario_usd').notNull().default(0),
  // Costo desglosado (USD) y su peso en el costo directo
  costoMaterialUsd: doublePrecision('costo_material_usd').notNull().default(0),
  costoMoUsd: doublePrecision('costo_mo_usd').notNull().default(0),
  // Desglose real de la MO (Base 0): fabricación y montaje por separado.
  // costoMoUsd se mantiene como la suma (fuente del costeo actual).
  costoMoFabUsd: doublePrecision('costo_mo_fab_usd').notNull().default(0),
  costoMoMontajeUsd: doublePrecision('costo_mo_montaje_usd').notNull().default(0),
  incidencia: doublePrecision('incidencia').notNull().default(0),
  costoTotalArs: doublePrecision('costo_total_ars').notNull().default(0),
  costoTotalUsd: doublePrecision('costo_total_usd').notNull().default(0),
  margen: doublePrecision('margen').notNull().default(0.2),
  precioVentaArs: doublePrecision('precio_venta_ars').notNull().default(0),
  precioVentaUsd: doublePrecision('precio_venta_usd').notNull().default(0),
  incluido: boolean('incluido').notNull().default(true),
  // 'base0' = generado por el motor (se reemplaza en cada recálculo);
  // 'manual' = agregado por el comercial (sobrevive al recálculo).
  origen: text('origen').notNull().default('base0'),
  orden: integer('orden').notNull().default(0),
}, (t) => [index('presupuesto_items_proyecto_idx').on(t.proyectoId)])

// ─── Biblioteca de precios de referencia (Revista Cifras) ──────
// Costos unitarios directos (material + ejecución) que el comercial consulta
// para agregar/ajustar ítems al editar una cotización Base 0 en borrador.
export const preciosReferencia = pgTable('precios_referencia', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  categoria: text('categoria').notNull().default(''),
  codigo: text('codigo').notNull().default(''),
  descripcion: text('descripcion').notNull(),
  unidad: text('unidad').notNull().default(''),
  costoMaterialUsd: doublePrecision('costo_material_usd').notNull().default(0),
  costoEjecucionUsd: doublePrecision('costo_ejecucion_usd').notNull().default(0),
  costoTotalUsd: doublePrecision('costo_total_usd').notNull().default(0),
  fuente: text('fuente').notNull().default('Revista Cifras'),
  activo: boolean('activo').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('precios_referencia_tenant_codigo_desc_idx').on(t.tenantId, t.codigo, t.descripcion)])

// ─── Documentación adjunta por el cliente ──────────────────────
// Archivos que el cliente sube desde el formulario de requerimientos (planos,
// pliegos, fotos, PDFs). Se guardan inline (base64) para no depender de un
// blob store externo; el comercial los descarga desde el detalle del proyecto.
export const documentosProyecto = pgTable('documentos_proyecto', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  tipoMime: text('tipo_mime').notNull().default(''),
  tamanoBytes: integer('tamano_bytes').notNull().default(0),
  contenidoBase64: text('contenido_base64').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('documentos_proyecto_idx').on(t.proyectoId)])

// ─── Cierre de la venta ────────────────────────────────────────
// El contrato congela lo acordado en la reunión de cierre: el presupuesto tal
// como quedó aprobado (en `snapshot`), los plazos y la forma de pago. Que el
// snapshot esté acá y no se recalcule es el punto: si mañana alguien toca el
// presupuesto, el contrato firmado sigue diciendo lo que se firmó.
export const contratos = pgTable('contratos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(),

  plazoEntregaDias: integer('plazo_entrega_dias').notNull().default(0),
  // Fechas como texto ISO 'AAAA-MM-DD': acá sólo interesa el día, y una
  // columna date vuelve del driver como Date con hora y zona.
  fechaInicio: text('fecha_inicio').notNull().default(''),
  anticipoPct: doublePrecision('anticipo_pct').notNull().default(0),
  formaPago: text('forma_pago').notNull().default(''),
  lugarEntrega: text('lugar_entrega').notNull().default(''),
  garantiaMeses: integer('garantia_meses').notNull().default(0),
  observaciones: text('observaciones').notNull().default(''),

  montoSinIvaUsd: doublePrecision('monto_sin_iva_usd').notNull().default(0),
  ivaUsd: doublePrecision('iva_usd').notNull().default(0),
  montoTotalUsd: doublePrecision('monto_total_usd').notNull().default(0),
  tipoCambio: doublePrecision('tipo_cambio').notNull().default(0),

  snapshot: jsonb('snapshot').notNull().default(sql`'{}'::jsonb`),

  firmadoAt: timestamp('firmado_at', { withTimezone: true }),
  firmadoPor: text('firmado_por').notNull().default(''),
  firmadoEmail: text('firmado_email').notNull().default(''),
  // 'digital' = el cliente aceptó desde su portal; 'manual' = se subió el
  // contrato firmado en papel.
  firmaMetodo: text('firma_metodo', { enum: ['digital', 'manual'] }),
  firmaReferencia: text('firma_referencia').notNull().default(''),

  emitidoPor: uuid('emitido_por').references(() => usuarios.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('contratos_proyecto_idx').on(t.proyectoId),
  uniqueIndex('contratos_tenant_numero_idx').on(t.tenantId, t.numero),
])

// Lo que recibe oficina técnica para empezar: datos técnicos, despiece y
// plazos. Sale del contrato firmado, nunca antes.
export const ordenesProduccion = pgTable('ordenes_produccion', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  contratoId: uuid('contrato_id').references(() => contratos.id, { onDelete: 'set null' }),
  numero: text('numero').notNull(),

  fechaEntregaComprometida: text('fecha_entrega_comprometida').notNull().default(''),
  prioridad: text('prioridad', { enum: ['baja', 'normal', 'alta'] }).notNull().default('normal'),
  estado: text('estado', { enum: ['abierta', 'en_proceso', 'cerrada'] }).notNull().default('abierta'),
  notasTaller: text('notas_taller').notNull().default(''),

  snapshot: jsonb('snapshot').notNull().default(sql`'{}'::jsonb`),

  // Dónde está la orden dentro del circuito de producción. 'compras' sólo
  // aparece cuando la verificación encontró faltantes.
  etapa: text('etapa', {
    enum: ['materiales', 'verificacion', 'compras', 'recepcion', 'fabricacion', 'despacho', 'obra', 'cerrada'],
  }).notNull().default('materiales'),
  etapaAt: timestamp('etapa_at', { withTimezone: true }).notNull().defaultNow(),

  emitidaPor: uuid('emitida_por').references(() => usuarios.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('ordenes_produccion_proyecto_idx').on(t.proyectoId),
  uniqueIndex('ordenes_produccion_tenant_numero_idx').on(t.tenantId, t.numero),
])

// ─── Circuito de producción ────────────────────────────────────
// De la orden de producción a la entrega en obra, con los cuatro sectores
// interviniendo por turno. Cada paso queda firmado en bitacoraOrden.

// El despiece físico: lo que hay que tener para poder fabricar. Hoy entra
// importando la estructura de producto del ERP; cuando esté el motor de
// explosión paramétrica va a entrar solo, con origen = 'explosion'.
export const materialesOrden = pgTable('materiales_orden', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ordenId: uuid('orden_id').notNull().references(() => ordenesProduccion.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),

  subconjunto: text('subconjunto').notNull().default(''),
  codigo: text('codigo').notNull().default(''),
  descripcion: text('descripcion').notNull(),
  unidad: text('unidad').notNull().default(''),

  cantidadRequerida: doublePrecision('cantidad_requerida').notNull().default(0),
  // Existencia que traía la exportación del ERP. Punto de partida de la
  // verificación, nunca la verificación misma: es stock general, no reservado.
  stockErp: doublePrecision('stock_erp'),
  cantidadDisponible: doublePrecision('cantidad_disponible').notNull().default(0),
  cantidadRecibida: doublePrecision('cantidad_recibida').notNull().default(0),

  estado: text('estado', {
    enum: ['pendiente', 'disponible', 'faltante', 'pedido', 'recibido'],
  }).notNull().default('pendiente'),
  origen: text('origen', { enum: ['flexxus', 'explosion', 'manual'] }).notNull().default('flexxus'),
  nota: text('nota').notNull().default(''),
  orden: integer('orden').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('materiales_orden_idx').on(t.ordenId),
  index('materiales_orden_proyecto_idx').on(t.proyectoId),
])

// No reemplaza a la OC del ERP: es el pedido formal de abastecimiento con los
// faltantes de esta obra, para que la compra se gestione y se pueda seguir.
export const ordenesCompra = pgTable('ordenes_compra', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ordenId: uuid('orden_id').notNull().references(() => ordenesProduccion.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(),

  estado: text('estado', {
    enum: ['borrador', 'pedida', 'recibida_parcial', 'recibida', 'anulada'],
  }).notNull().default('borrador'),
  fechaNecesidad: text('fecha_necesidad').notNull().default(''),
  proveedor: text('proveedor').notNull().default(''),
  referenciaErp: text('referencia_erp').notNull().default(''),
  notas: text('notas').notNull().default(''),

  emitidaPor: uuid('emitida_por').references(() => usuarios.id, { onDelete: 'set null' }),
  pedidaAt: timestamp('pedida_at', { withTimezone: true }),
  cerradaAt: timestamp('cerrada_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ordenes_compra_orden_idx').on(t.ordenId),
  uniqueIndex('ordenes_compra_tenant_numero_idx').on(t.tenantId, t.numero),
])

export const ordenesCompraItems = pgTable('ordenes_compra_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ordenCompraId: uuid('orden_compra_id').notNull().references(() => ordenesCompra.id, { onDelete: 'cascade' }),
  materialId: uuid('material_id').notNull().references(() => materialesOrden.id, { onDelete: 'cascade' }),
  cantidad: doublePrecision('cantidad').notNull().default(0),
  cantidadRecibida: doublePrecision('cantidad_recibida').notNull().default(0),
}, (t) => [index('ordenes_compra_items_oc_idx').on(t.ordenCompraId)])

// Un renglón por ingreso real. No se pisa la cantidad: se suma, para que
// queden registrados los ingresos parciales.
export const recepcionesMaterial = pgTable('recepciones_material', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ordenId: uuid('orden_id').notNull().references(() => ordenesProduccion.id, { onDelete: 'cascade' }),
  materialId: uuid('material_id').notNull().references(() => materialesOrden.id, { onDelete: 'cascade' }),
  ordenCompraId: uuid('orden_compra_id').references(() => ordenesCompra.id, { onDelete: 'set null' }),

  cantidad: doublePrecision('cantidad').notNull().default(0),
  remitoProveedor: text('remito_proveedor').notNull().default(''),
  observaciones: text('observaciones').notNull().default(''),
  documentoId: uuid('documento_id').references(() => documentosProyecto.id, { onDelete: 'set null' }),

  registradaPor: uuid('registrada_por').references(() => usuarios.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('recepciones_material_orden_idx').on(t.ordenId)])

// Lo que el taller produce, normalmente un renglón por subconjunto.
export const partesFabricacion = pgTable('partes_fabricacion', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ordenId: uuid('orden_id').notNull().references(() => ordenesProduccion.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),

  nombre: text('nombre').notNull(),
  cantidad: doublePrecision('cantidad').notNull().default(1),
  unidad: text('unidad').notNull().default('un'),
  estado: text('estado', { enum: ['pendiente', 'en_proceso', 'terminada'] }).notNull().default('pendiente'),
  cantidadDespachada: doublePrecision('cantidad_despachada').notNull().default(0),
  responsable: text('responsable').notNull().default(''),
  notas: text('notas').notNull().default(''),
  orden: integer('orden').notNull().default(0),

  iniciadaAt: timestamp('iniciada_at', { withTimezone: true }),
  terminadaAt: timestamp('terminada_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('partes_fabricacion_orden_idx').on(t.ordenId)])

// Una nave sale en varios viajes. Cada despacho es un remito con su control de
// recepción en obra: sin ese control el despacho no se da por entregado.
export const despachos = pgTable('despachos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ordenId: uuid('orden_id').notNull().references(() => ordenesProduccion.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  numero: text('numero').notNull(),

  estado: text('estado', {
    enum: ['preparado', 'en_transito', 'entregado', 'rechazado'],
  }).notNull().default('preparado'),
  fechaSalida: text('fecha_salida').notNull().default(''),
  transporte: text('transporte').notNull().default(''),
  chofer: text('chofer').notNull().default(''),
  patente: text('patente').notNull().default(''),
  destino: text('destino').notNull().default(''),
  observaciones: text('observaciones').notNull().default(''),

  despachadoPor: uuid('despachado_por').references(() => usuarios.id, { onDelete: 'set null' }),
  despachadoAt: timestamp('despachado_at', { withTimezone: true }),

  recibidoPor: text('recibido_por').notNull().default(''),
  recibidoAt: timestamp('recibido_at', { withTimezone: true }),
  conformidad: text('conformidad').notNull().default(''),
  observacionesObra: text('observaciones_obra').notNull().default(''),
  documentoId: uuid('documento_id').references(() => documentosProyecto.id, { onDelete: 'set null' }),
  registradoPor: uuid('registrado_por').references(() => usuarios.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('despachos_orden_idx').on(t.ordenId),
  uniqueIndex('despachos_tenant_numero_idx').on(t.tenantId, t.numero),
])

export const despachoItems = pgTable('despacho_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  despachoId: uuid('despacho_id').notNull().references(() => despachos.id, { onDelete: 'cascade' }),
  parteId: uuid('parte_id').references(() => partesFabricacion.id, { onDelete: 'set null' }),
  descripcion: text('descripcion').notNull(),
  cantidad: doublePrecision('cantidad').notNull().default(0),
  unidad: text('unidad').notNull().default('un'),
  // Lo que efectivamente llegó, que puede no ser lo que salió.
  cantidadRecibida: doublePrecision('cantidad_recibida').notNull().default(0),
  observaciones: text('observaciones').notNull().default(''),
}, (t) => [index('despacho_items_despacho_idx').on(t.despachoId)])

// Todo paso del circuito deja un renglón acá. Es lo que permite contestar
// "¿por qué esta obra está parada?".
export const bitacoraOrden = pgTable('bitacora_orden', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ordenId: uuid('orden_id').notNull().references(() => ordenesProduccion.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),

  sector: text('sector').notNull().default(''),
  etapa: text('etapa').notNull().default(''),
  accion: text('accion').notNull(),
  detalle: text('detalle').notNull().default(''),

  usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  usuarioNombre: text('usuario_nombre').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('bitacora_orden_idx').on(t.ordenId, t.createdAt)])

// ─── Ingestas (WhatsApp / audio / texto crudo) ─────────────────

export const ingestas = pgTable('ingestas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  canal: text('canal').notNull(),
  rawContent: text('raw_content').notNull().default(''),
  variablesExtraidas: jsonb('variables_extraidas'),
  procesado: boolean('procesado').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ingestas_tenant_idx').on(t.tenantId)])

// ─── Configuración global (tipo de cambio, margen default, …) ──

// Parámetros de costeo: son por empresa, así que la clave es (tenant, clave).
export const configuracion = pgTable('configuracion', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(),
  valor: jsonb('valor').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.clave] })])

// ─── Relations ─────────────────────────────────────────────────

export const rubrosRelations = relations(rubros, ({ many }) => ({
  subrubros: many(subrubros),
}))

export const subrubrosRelations = relations(subrubros, ({ one, many }) => ({
  rubro: one(rubros, { fields: [subrubros.rubroId], references: [rubros.id] }),
  ratios: many(ratiosCostos),
}))

export const ratiosCostosRelations = relations(ratiosCostos, ({ one }) => ({
  subrubro: one(subrubros, { fields: [ratiosCostos.subrubroId], references: [subrubros.id] }),
}))

export const proyectosRelations = relations(proyectos, ({ many, one }) => ({
  datosTecnicos: many(datosTecnicos),
  items: many(presupuestoBaseItems),
  documentos: many(documentosProyecto),
  contrato: one(contratos, { fields: [proyectos.id], references: [contratos.proyectoId] }),
  ordenProduccion: one(ordenesProduccion, { fields: [proyectos.id], references: [ordenesProduccion.proyectoId] }),
}))

export const contratosRelations = relations(contratos, ({ one }) => ({
  proyecto: one(proyectos, { fields: [contratos.proyectoId], references: [proyectos.id] }),
}))

export const ordenesProduccionRelations = relations(ordenesProduccion, ({ one, many }) => ({
  proyecto: one(proyectos, { fields: [ordenesProduccion.proyectoId], references: [proyectos.id] }),
  contrato: one(contratos, { fields: [ordenesProduccion.contratoId], references: [contratos.id] }),
  materiales: many(materialesOrden),
  ordenesCompra: many(ordenesCompra),
  partes: many(partesFabricacion),
  despachos: many(despachos),
  bitacora: many(bitacoraOrden),
}))

export const materialesOrdenRelations = relations(materialesOrden, ({ one, many }) => ({
  orden: one(ordenesProduccion, { fields: [materialesOrden.ordenId], references: [ordenesProduccion.id] }),
  recepciones: many(recepcionesMaterial),
}))

export const ordenesCompraRelations = relations(ordenesCompra, ({ one, many }) => ({
  orden: one(ordenesProduccion, { fields: [ordenesCompra.ordenId], references: [ordenesProduccion.id] }),
  proyecto: one(proyectos, { fields: [ordenesCompra.proyectoId], references: [proyectos.id] }),
  items: many(ordenesCompraItems),
}))

export const ordenesCompraItemsRelations = relations(ordenesCompraItems, ({ one }) => ({
  ordenCompra: one(ordenesCompra, { fields: [ordenesCompraItems.ordenCompraId], references: [ordenesCompra.id] }),
  material: one(materialesOrden, { fields: [ordenesCompraItems.materialId], references: [materialesOrden.id] }),
}))

export const recepcionesMaterialRelations = relations(recepcionesMaterial, ({ one }) => ({
  material: one(materialesOrden, { fields: [recepcionesMaterial.materialId], references: [materialesOrden.id] }),
  orden: one(ordenesProduccion, { fields: [recepcionesMaterial.ordenId], references: [ordenesProduccion.id] }),
}))

export const partesFabricacionRelations = relations(partesFabricacion, ({ one }) => ({
  orden: one(ordenesProduccion, { fields: [partesFabricacion.ordenId], references: [ordenesProduccion.id] }),
}))

export const despachosRelations = relations(despachos, ({ one, many }) => ({
  orden: one(ordenesProduccion, { fields: [despachos.ordenId], references: [ordenesProduccion.id] }),
  proyecto: one(proyectos, { fields: [despachos.proyectoId], references: [proyectos.id] }),
  items: many(despachoItems),
}))

export const despachoItemsRelations = relations(despachoItems, ({ one }) => ({
  despacho: one(despachos, { fields: [despachoItems.despachoId], references: [despachos.id] }),
  parte: one(partesFabricacion, { fields: [despachoItems.parteId], references: [partesFabricacion.id] }),
}))

export const bitacoraOrdenRelations = relations(bitacoraOrden, ({ one }) => ({
  orden: one(ordenesProduccion, { fields: [bitacoraOrden.ordenId], references: [ordenesProduccion.id] }),
  usuario: one(usuarios, { fields: [bitacoraOrden.usuarioId], references: [usuarios.id] }),
}))

export const documentosProyectoRelations = relations(documentosProyecto, ({ one }) => ({
  proyecto: one(proyectos, { fields: [documentosProyecto.proyectoId], references: [proyectos.id] }),
}))

export const datosTecnicosRelations = relations(datosTecnicos, ({ one }) => ({
  proyecto: one(proyectos, { fields: [datosTecnicos.proyectoId], references: [proyectos.id] }),
}))

export const presupuestoBaseItemsRelations = relations(presupuestoBaseItems, ({ one }) => ({
  proyecto: one(proyectos, { fields: [presupuestoBaseItems.proyectoId], references: [proyectos.id] }),
  rubro: one(rubros, { fields: [presupuestoBaseItems.rubroId], references: [rubros.id] }),
  subrubro: one(subrubros, { fields: [presupuestoBaseItems.subrubroId], references: [subrubros.id] }),
}))

export const sesionesRelations = relations(sesiones, ({ one }) => ({
  usuario: one(usuarios, { fields: [sesiones.usuarioId], references: [usuarios.id] }),
}))

export const tenantsRelations = relations(tenants, ({ many }) => ({
  dominios: many(tenantDominios),
}))

export const tenantDominiosRelations = relations(tenantDominios, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantDominios.tenantId], references: [tenants.id] }),
}))

// ─── Row types ─────────────────────────────────────────────────

export type Tenant = typeof tenants.$inferSelect
export type NuevoTenant = typeof tenants.$inferInsert
export type TenantDominio = typeof tenantDominios.$inferSelect
export type Usuario = typeof usuarios.$inferSelect
export type Proyecto = typeof proyectos.$inferSelect
export type DatosTecnicosRow = typeof datosTecnicos.$inferSelect
export type PresupuestoItem = typeof presupuestoBaseItems.$inferSelect
export type NuevoPresupuestoItem = typeof presupuestoBaseItems.$inferInsert
export type RatioCosto = typeof ratiosCostos.$inferSelect
export type Rubro = typeof rubros.$inferSelect
export type Subrubro = typeof subrubros.$inferSelect
export type PrecioReferencia = typeof preciosReferencia.$inferSelect
export type NuevoPrecioReferencia = typeof preciosReferencia.$inferInsert
export type DocumentoProyecto = typeof documentosProyecto.$inferSelect
export type NuevoDocumentoProyecto = typeof documentosProyecto.$inferInsert
export type Contrato = typeof contratos.$inferSelect
export type NuevoContrato = typeof contratos.$inferInsert
export type OrdenProduccion = typeof ordenesProduccion.$inferSelect
export type NuevaOrdenProduccion = typeof ordenesProduccion.$inferInsert
export type EtapaProduccion = OrdenProduccion['etapa']
export type MaterialOrden = typeof materialesOrden.$inferSelect
export type NuevoMaterialOrden = typeof materialesOrden.$inferInsert
export type OrdenCompra = typeof ordenesCompra.$inferSelect
export type OrdenCompraItem = typeof ordenesCompraItems.$inferSelect
export type RecepcionMaterial = typeof recepcionesMaterial.$inferSelect
export type ParteFabricacion = typeof partesFabricacion.$inferSelect
export type NuevaParteFabricacion = typeof partesFabricacion.$inferInsert
export type Despacho = typeof despachos.$inferSelect
export type DespachoItem = typeof despachoItems.$inferSelect
export type BitacoraOrden = typeof bitacoraOrden.$inferSelect
