import {
  pgTable, uuid, text, boolean, integer, doublePrecision, timestamp, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Auth ──────────────────────────────────────────────────────

export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  nombre: text('nombre').notNull().default(''),
  rol: text('rol', { enum: ['admin', 'comercial', 'cliente'] }).notNull().default('cliente'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('usuarios_email_idx').on(t.email)])

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
  nombre: text('nombre').notNull(),
  codigoFlexxus: integer('codigo_flexxus').notNull().default(0),
  orden: integer('orden').notNull().default(0),
})

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
  // Total (= material + mo). Se mantiene por compatibilidad con la UI existente.
  precioUnitarioArs: doublePrecision('precio_unitario_ars').notNull().default(0),
  precioUnitarioUsd: doublePrecision('precio_unitario_usd').notNull().default(0),
  vigente: boolean('vigente').notNull().default(true),
  fechaActualizacion: timestamp('fecha_actualizacion', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Proyectos ─────────────────────────────────────────────────

export const proyectos = pgTable('proyectos', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
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
}, (t) => [uniqueIndex('proyectos_codigo_idx').on(t.codigo), index('proyectos_email_idx').on(t.email)])

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
  incidencia: doublePrecision('incidencia').notNull().default(0),
  costoTotalArs: doublePrecision('costo_total_ars').notNull().default(0),
  costoTotalUsd: doublePrecision('costo_total_usd').notNull().default(0),
  margen: doublePrecision('margen').notNull().default(0.2),
  precioVentaArs: doublePrecision('precio_venta_ars').notNull().default(0),
  precioVentaUsd: doublePrecision('precio_venta_usd').notNull().default(0),
  incluido: boolean('incluido').notNull().default(true),
  orden: integer('orden').notNull().default(0),
}, (t) => [index('presupuesto_items_proyecto_idx').on(t.proyectoId)])

// ─── Ingestas (WhatsApp / audio / texto crudo) ─────────────────

export const ingestas = pgTable('ingestas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  canal: text('canal').notNull(),
  rawContent: text('raw_content').notNull().default(''),
  variablesExtraidas: jsonb('variables_extraidas'),
  procesado: boolean('procesado').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Configuración global (tipo de cambio, margen default, …) ──

export const configuracion = pgTable('configuracion', {
  clave: text('clave').primaryKey(),
  valor: jsonb('valor').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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

// ─── Row types ─────────────────────────────────────────────────

export type Usuario = typeof usuarios.$inferSelect
export type Proyecto = typeof proyectos.$inferSelect
export type DatosTecnicosRow = typeof datosTecnicos.$inferSelect
export type PresupuestoItem = typeof presupuestoBaseItems.$inferSelect
export type NuevoPresupuestoItem = typeof presupuestoBaseItems.$inferInsert
export type RatioCosto = typeof ratiosCostos.$inferSelect
export type Rubro = typeof rubros.$inferSelect
export type Subrubro = typeof subrubros.$inferSelect
