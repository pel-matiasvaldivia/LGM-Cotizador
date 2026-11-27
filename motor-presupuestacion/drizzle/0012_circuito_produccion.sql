-- Circuito de producción: de la orden de producción a la entrega en obra.
--
-- Hasta acá el sistema terminaba cuando se emitía la orden de producción. Lo
-- que sigue —verificar materiales, comprar lo que falta, recibirlo, fabricar,
-- despachar y controlar la llegada a la obra— pasaba por fuera, repartido
-- entre planillas, WhatsApp y el ERP.
--
-- Estas tablas registran ese circuito con cuatro sectores que intervienen por
-- turno: oficina técnica, abastecimiento, taller, y logística y obra. Cada
-- paso queda firmado por quien lo hizo (bitacora_orden): la trazabilidad es el
-- punto del módulo, no un extra.

-- ─── Sectores de los usuarios ──────────────────────────────────
-- Un usuario puede pertenecer a más de un sector: en una PyME la misma persona
-- compra y recibe. El rol ('admin' | 'comercial' | 'cliente') sigue decidiendo
-- a qué parte del sistema entra; el sector, qué pasos del circuito puede dar.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sectores jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

-- ─── Etapa del circuito ────────────────────────────────────────
-- materiales → verificacion → (compras) → recepcion → fabricacion →
-- despacho → obra → cerrada. 'compras' sólo aparece si falta algo.
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS etapa text NOT NULL DEFAULT 'materiales';
--> statement-breakpoint
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS etapa_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint

-- ─── Materiales de la orden ────────────────────────────────────
-- El despiece físico de la obra: lo que hay que tener para poder fabricar.
-- Hoy entra importando la estructura de producto del ERP; cuando esté el motor
-- de explosión paramétrica va a entrar solo, con origen = 'explosion'.
CREATE TABLE IF NOT EXISTS materiales_orden (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

	-- Agrupador de la estructura de producto (CASABENE_VIGAS_V03, …)
	subconjunto text NOT NULL DEFAULT '',
	codigo text NOT NULL DEFAULT '',
	descripcion text NOT NULL,
	unidad text NOT NULL DEFAULT '',

	cantidad_requerida double precision NOT NULL DEFAULT 0,
	-- Lo que abastecimiento confirmó que hay en depósito
	cantidad_disponible double precision NOT NULL DEFAULT 0,
	-- Ingresos registrados contra esta línea
	cantidad_recibida double precision NOT NULL DEFAULT 0,

	-- pendiente → disponible | faltante → pedido → recibido
	estado text NOT NULL DEFAULT 'pendiente',
	origen text NOT NULL DEFAULT 'flexxus',
	nota text NOT NULL DEFAULT '',
	orden integer NOT NULL DEFAULT 0,

	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS materiales_orden_idx ON materiales_orden (orden_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS materiales_orden_proyecto_idx ON materiales_orden (proyecto_id);
--> statement-breakpoint

-- ─── Orden de compra de referencia ─────────────────────────────
-- No reemplaza a la OC del ERP: es el pedido formal de abastecimiento con los
-- faltantes de ESTA obra, para que la compra se gestione y se pueda seguir.
CREATE TABLE IF NOT EXISTS ordenes_compra (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
	numero text NOT NULL,

	-- borrador → pedida → recibida_parcial → recibida (o anulada)
	estado text NOT NULL DEFAULT 'borrador',
	fecha_necesidad text NOT NULL DEFAULT '',
	proveedor text NOT NULL DEFAULT '',
	referencia_erp text NOT NULL DEFAULT '',
	notas text NOT NULL DEFAULT '',

	emitida_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	pedida_at timestamptz,
	cerrada_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ordenes_compra_orden_idx ON ordenes_compra (orden_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ordenes_compra_tenant_numero_idx ON ordenes_compra (tenant_id, numero);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ordenes_compra_items (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	orden_compra_id uuid NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
	material_id uuid NOT NULL REFERENCES materiales_orden(id) ON DELETE CASCADE,
	cantidad double precision NOT NULL DEFAULT 0,
	cantidad_recibida double precision NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ordenes_compra_items_oc_idx ON ordenes_compra_items (orden_compra_id);
--> statement-breakpoint

-- ─── Ingreso de materiales ─────────────────────────────────────
-- Un renglón por cada ingreso real, con el remito del proveedor. No se pisa la
-- cantidad: se suma, para que queden los ingresos parciales.
CREATE TABLE IF NOT EXISTS recepciones_material (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
	material_id uuid NOT NULL REFERENCES materiales_orden(id) ON DELETE CASCADE,
	orden_compra_id uuid REFERENCES ordenes_compra(id) ON DELETE SET NULL,

	cantidad double precision NOT NULL DEFAULT 0,
	remito_proveedor text NOT NULL DEFAULT '',
	observaciones text NOT NULL DEFAULT '',
	documento_id uuid REFERENCES documentos_proyecto(id) ON DELETE SET NULL,

	registrada_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS recepciones_material_orden_idx ON recepciones_material (orden_id);
--> statement-breakpoint

-- ─── Partes a fabricar ─────────────────────────────────────────
-- Lo que el taller produce, normalmente un renglón por subconjunto de la
-- estructura (columnas, vigas, correas, cierre lateral).
CREATE TABLE IF NOT EXISTS partes_fabricacion (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

	nombre text NOT NULL,
	cantidad double precision NOT NULL DEFAULT 1,
	unidad text NOT NULL DEFAULT 'un',
	-- pendiente → en_proceso → terminada
	estado text NOT NULL DEFAULT 'pendiente',
	-- Lo ya despachado de esta parte, para no mandar dos veces lo mismo
	cantidad_despachada double precision NOT NULL DEFAULT 0,
	responsable text NOT NULL DEFAULT '',
	notas text NOT NULL DEFAULT '',
	orden integer NOT NULL DEFAULT 0,

	iniciada_at timestamptz,
	terminada_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS partes_fabricacion_orden_idx ON partes_fabricacion (orden_id);
--> statement-breakpoint

-- ─── Despacho a obra y control de llegada ──────────────────────
-- Una nave sale en varios viajes. Cada despacho es un remito, y cada remito
-- tiene su control de recepción en la obra: quién recibió, cuándo, y si llegó
-- conforme. Sin ese control el despacho no se da por entregado.
CREATE TABLE IF NOT EXISTS despachos (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
	numero text NOT NULL,

	-- preparado → en_transito → entregado (o rechazado en obra)
	estado text NOT NULL DEFAULT 'preparado',
	fecha_salida text NOT NULL DEFAULT '',
	transporte text NOT NULL DEFAULT '',
	chofer text NOT NULL DEFAULT '',
	patente text NOT NULL DEFAULT '',
	destino text NOT NULL DEFAULT '',
	observaciones text NOT NULL DEFAULT '',

	despachado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	despachado_at timestamptz,

	-- Control en obra
	recibido_por text NOT NULL DEFAULT '',
	recibido_at timestamptz,
	conformidad text NOT NULL DEFAULT '',
	observaciones_obra text NOT NULL DEFAULT '',
	documento_id uuid REFERENCES documentos_proyecto(id) ON DELETE SET NULL,
	registrado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,

	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS despachos_orden_idx ON despachos (orden_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS despachos_tenant_numero_idx ON despachos (tenant_id, numero);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS despacho_items (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	despacho_id uuid NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
	parte_id uuid REFERENCES partes_fabricacion(id) ON DELETE SET NULL,
	descripcion text NOT NULL,
	cantidad double precision NOT NULL DEFAULT 0,
	unidad text NOT NULL DEFAULT 'un',
	-- Lo que efectivamente llegó, que puede no ser lo que salió
	cantidad_recibida double precision NOT NULL DEFAULT 0,
	observaciones text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS despacho_items_despacho_idx ON despacho_items (despacho_id);
--> statement-breakpoint

-- ─── Bitácora ──────────────────────────────────────────────────
-- Todo paso del circuito deja un renglón acá: qué sector, qué hizo, cuándo y
-- quién. Es lo que permite contestar "¿por qué esta obra está parada?".
CREATE TABLE IF NOT EXISTS bitacora_orden (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	orden_id uuid NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,

	sector text NOT NULL DEFAULT '',
	etapa text NOT NULL DEFAULT '',
	accion text NOT NULL,
	detalle text NOT NULL DEFAULT '',

	usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	usuario_nombre text NOT NULL DEFAULT '',
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bitacora_orden_idx ON bitacora_orden (orden_id, created_at);
