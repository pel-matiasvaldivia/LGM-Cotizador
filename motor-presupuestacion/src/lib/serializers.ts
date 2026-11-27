import type {
  BitacoraOrden, Contrato, DatosTecnicosRow, Despacho, DespachoItem, MaterialOrden, OrdenCompra,
  OrdenCompraItem, OrdenProduccion, ParteFabricacion, PresupuestoItem, Proyecto,
} from '@/db/schema'

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

// Cierre de la venta. El snapshot (el presupuesto congelado) no viaja a la UI:
// pesa, y ahí se muestran los totales, no el detalle.
export function contratoToRow(c: Contrato) {
  return {
    id: c.id,
    numero: c.numero,
    plazo_entrega_dias: c.plazoEntregaDias,
    fecha_inicio: c.fechaInicio,
    anticipo_pct: c.anticipoPct,
    forma_pago: c.formaPago,
    lugar_entrega: c.lugarEntrega,
    garantia_meses: c.garantiaMeses,
    observaciones: c.observaciones,
    monto_sin_iva_usd: c.montoSinIvaUsd,
    iva_usd: c.ivaUsd,
    monto_total_usd: c.montoTotalUsd,
    firmado_at: c.firmadoAt ? c.firmadoAt.toISOString() : null,
    firmado_por: c.firmadoPor,
    firmado_email: c.firmadoEmail,
    firma_metodo: c.firmaMetodo,
    created_at: c.createdAt.toISOString(),
  }
}

export function ordenToRow(o: OrdenProduccion) {
  return {
    id: o.id,
    numero: o.numero,
    fecha_entrega_comprometida: o.fechaEntregaComprometida,
    prioridad: o.prioridad,
    estado: o.estado,
    etapa: o.etapa,
    etapa_at: o.etapaAt?.toISOString() ?? null,
    notas_taller: o.notasTaller,
    created_at: o.createdAt.toISOString(),
  }
}

// ─── Circuito de producción ────────────────────────────────────

export function materialToRow(m: MaterialOrden) {
  const pendiente = Math.max(m.cantidadRequerida - m.cantidadDisponible - m.cantidadRecibida, 0)
  return {
    id: m.id,
    subconjunto: m.subconjunto,
    codigo: m.codigo,
    descripcion: m.descripcion,
    unidad: m.unidad,
    cantidad_requerida: m.cantidadRequerida,
    stock_erp: m.stockErp,
    cantidad_disponible: m.cantidadDisponible,
    cantidad_recibida: m.cantidadRecibida,
    // Lo que todavía falta conseguir: es el número que mira abastecimiento.
    cantidad_pendiente: Number(pendiente.toFixed(4)),
    estado: m.estado,
    origen: m.origen,
    nota: m.nota,
  }
}

export function ordenCompraToRow(o: OrdenCompra, items: OrdenCompraItem[] = []) {
  return {
    id: o.id,
    numero: o.numero,
    estado: o.estado,
    fecha_necesidad: o.fechaNecesidad,
    proveedor: o.proveedor,
    referencia_erp: o.referenciaErp,
    notas: o.notas,
    pedida_at: o.pedidaAt?.toISOString() ?? null,
    cerrada_at: o.cerradaAt?.toISOString() ?? null,
    created_at: o.createdAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      material_id: i.materialId,
      cantidad: i.cantidad,
      cantidad_recibida: i.cantidadRecibida,
    })),
  }
}

export function parteToRow(p: ParteFabricacion) {
  return {
    id: p.id,
    nombre: p.nombre,
    cantidad: p.cantidad,
    unidad: p.unidad,
    estado: p.estado,
    cantidad_despachada: p.cantidadDespachada,
    responsable: p.responsable,
    notas: p.notas,
    iniciada_at: p.iniciadaAt?.toISOString() ?? null,
    terminada_at: p.terminadaAt?.toISOString() ?? null,
  }
}

export function despachoToRow(d: Despacho, items: DespachoItem[] = []) {
  return {
    id: d.id,
    numero: d.numero,
    estado: d.estado,
    fecha_salida: d.fechaSalida,
    transporte: d.transporte,
    chofer: d.chofer,
    patente: d.patente,
    destino: d.destino,
    observaciones: d.observaciones,
    despachado_at: d.despachadoAt?.toISOString() ?? null,
    recibido_por: d.recibidoPor,
    recibido_at: d.recibidoAt?.toISOString() ?? null,
    conformidad: d.conformidad,
    observaciones_obra: d.observacionesObra,
    items: items.map((i) => ({
      id: i.id,
      parte_id: i.parteId,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      cantidad_recibida: i.cantidadRecibida,
      observaciones: i.observaciones,
    })),
  }
}

export function bitacoraToRow(b: BitacoraOrden) {
  return {
    id: b.id,
    sector: b.sector,
    etapa: b.etapa,
    accion: b.accion,
    detalle: b.detalle,
    usuario: b.usuarioNombre,
    created_at: b.createdAt.toISOString(),
  }
}
