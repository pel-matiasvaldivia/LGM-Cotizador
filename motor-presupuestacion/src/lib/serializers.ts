import type { DatosTecnicosRow, PresupuestoItem, Proyecto } from '@/db/schema'

// Los componentes de UI consumen los nombres de columna (snake_case),
// heredados del cliente de Supabase. Estos serializers mantienen ese contrato.

export function itemToRow(i: PresupuestoItem & { rubro?: { nombre: string } | null; subrubro?: { nombre: string; rubro?: { nombre: string } | null } | null }) {
  return {
    id: i.id,
    proyecto_id: i.proyectoId,
    rubro_id: i.rubroId,
    subrubro_id: i.subrubroId,
    descripcion: i.descripcion,
    unidad: i.unidad,
    cantidad: i.cantidad,
    precio_unitario_ars: i.precioUnitarioArs,
    precio_unitario_usd: i.precioUnitarioUsd,
    costo_material_usd: i.costoMaterialUsd,
    costo_mo_usd: i.costoMoUsd,
    incidencia: i.incidencia,
    costo_total_ars: i.costoTotalArs,
    costo_total_usd: i.costoTotalUsd,
    margen: i.margen,
    precio_venta_ars: i.precioVentaArs,
    precio_venta_usd: i.precioVentaUsd,
    incluido: i.incluido,
    origen: i.origen,
    orden: i.orden,
    rubros: i.rubro ? { nombre: i.rubro.nombre } : null,
    subrubros: i.subrubro ? { nombre: i.subrubro.nombre, rubros: i.subrubro.rubro ? { nombre: i.subrubro.rubro.nombre } : null } : null,
  }
}

export function proyectoToRow(p: Proyecto) {
  return {
    id: p.id,
    codigo: p.codigo,
    cliente: p.cliente,
    razon_social: p.razonSocial,
    contacto: p.contacto,
    dni: p.dni,
    telefono: p.telefono,
    email: p.email,
    ubicacion: p.ubicacion,
    canal_origen: p.canalOrigen,
    estado: p.estado,
    observaciones: p.observaciones,
    created_at: p.createdAt.toISOString(),
  }
}

export function datosTecnicosToRow(d: DatosTecnicosRow) {
  return {
    id: d.id,
    proyecto_id: d.proyectoId,
    ancho: d.ancho,
    largo: d.largo,
    superficie: d.superficie,
    altura_libre: d.alturaLibre,
    distancia_obra_km: d.distanciaObraKm,
    tipologia: d.tipologia,
    tipo_cubierta: d.tipoCubierta,
    tipo_cerramiento: d.tipoCerramiento,
    incluye_fabricacion: d.incluyeFabricacion,
    incluye_montaje: d.incluyeMontaje,
    incluye_cubierta: d.incluyeCubierta,
    incluye_cerramiento_lateral: d.incluyeCerramientoLateral,
    incluye_portones: d.incluyePortones,
    incluye_piso: d.incluyePiso,
    incluye_electrica: d.incluyeElectrica,
    incluye_sanitaria: d.incluyeSanitaria,
    cantidad_portones: d.cantidadPortones,
    especificaciones_adicionales: d.especificacionesAdicionales,
    raw_data: d.rawData,
    created_at: d.createdAt.toISOString(),
  }
}
