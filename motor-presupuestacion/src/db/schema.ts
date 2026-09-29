import {
  pgTable, uuid, text, boolean, integer, doublePrecision, timestamp, jsonb, uniqueIndex, index,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

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
  // Administrador de la PLATAFORMA: da de alta empresas, les asigna dominios y
  // les crea su primer admin. Es ortogonal a `rol`, que es el rol dentro de la
  // empresa por la que el usuario entra.
  superadmin: boolean('superadmin').notNull().default(false),
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
  estado: text('estado', { enum: ['borrador', 'enviado', 'preaprobado', 'aprobado'] }).notNull().default('borrador'),
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

export const proyectosRelations = relations(proyectos, ({ many }) => ({
  datosTecnicos: many(datosTecnicos),
  items: many(presupuestoBaseItems),
  documentos: many(documentosProyecto),
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
