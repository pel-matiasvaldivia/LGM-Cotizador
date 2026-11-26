-- Cierre de la venta: contrato y orden de producción.
--
-- Hasta acá el proyecto terminaba en "preaprobado" y lo que seguía (la reunión,
-- el acuerdo, el arranque de oficina técnica) pasaba fuera del sistema. Estas
-- dos tablas registran esa parte:
--
--   1. El contrato congela lo acordado: el presupuesto tal como quedó aprobado,
--      los plazos y la forma de pago. Se firma (digital o en papel escaneado).
--   2. Con el contrato firmado se emite la orden de producción, que es lo que
--      recibe oficina técnica para empezar.
--
-- Los dos guardan un `snapshot` del presupuesto y los datos técnicos del
-- momento: si después alguien toca el presupuesto, el contrato firmado sigue
-- diciendo lo que se firmó.

CREATE TABLE IF NOT EXISTS contratos (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
	numero text NOT NULL,

	-- Condiciones acordadas en la reunión de cierre
	plazo_entrega_dias integer NOT NULL DEFAULT 0,
	-- Las fechas van como texto ISO ('AAAA-MM-DD'): una columna date vuelve del
	-- driver como Date con hora y zona, y acá sólo interesa el día.
	fecha_inicio text NOT NULL DEFAULT '',
	anticipo_pct double precision NOT NULL DEFAULT 0,
	forma_pago text NOT NULL DEFAULT '',
	lugar_entrega text NOT NULL DEFAULT '',
	garantia_meses integer NOT NULL DEFAULT 0,
	observaciones text NOT NULL DEFAULT '',

	-- Importes congelados al emitir (USD)
	monto_sin_iva_usd double precision NOT NULL DEFAULT 0,
	iva_usd double precision NOT NULL DEFAULT 0,
	monto_total_usd double precision NOT NULL DEFAULT 0,
	tipo_cambio double precision NOT NULL DEFAULT 0,

	-- Presupuesto y datos técnicos tal como estaban al emitir
	snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

	-- Firma
	firmado_at timestamptz,
	firmado_por text NOT NULL DEFAULT '',
	firmado_email text NOT NULL DEFAULT '',
	firma_metodo text,
	firma_referencia text NOT NULL DEFAULT '',

	emitido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS contratos_proyecto_idx ON contratos (proyecto_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS contratos_tenant_numero_idx ON contratos (tenant_id, numero);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ordenes_produccion (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
	contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
	numero text NOT NULL,

	fecha_entrega_comprometida text NOT NULL DEFAULT '',
	prioridad text NOT NULL DEFAULT 'normal',
	estado text NOT NULL DEFAULT 'abierta',
	notas_taller text NOT NULL DEFAULT '',

	-- Datos técnicos y despiece tal como se emitieron a oficina técnica
	snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

	emitida_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ordenes_produccion_proyecto_idx ON ordenes_produccion (proyecto_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ordenes_produccion_tenant_numero_idx ON ordenes_produccion (tenant_id, numero);
