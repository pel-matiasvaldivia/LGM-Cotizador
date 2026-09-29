-- Multi-tenant por dominio: cada empresa que contrata el servicio es un tenant,
-- con su identidad visible y sus datos fiscales (los que salen impresos en el
-- presupuesto). Los datos existentes se migran al tenant por defecto, que el
-- bootstrap de scripts/migrate.mjs completa desde la config de archivo.

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  activo boolean NOT NULL DEFAULT true,

  nombre text NOT NULL,
  razon_social text NOT NULL DEFAULT '',
  tagline text NOT NULL DEFAULT '',

  cuit text NOT NULL DEFAULT '',
  condicion_iva text NOT NULL DEFAULT '',
  ingresos_brutos text NOT NULL DEFAULT '',
  inicio_actividades text NOT NULL DEFAULT '',

  domicilio text NOT NULL DEFAULT '',
  localidad text NOT NULL DEFAULT '',
  provincia text NOT NULL DEFAULT '',
  codigo_postal text NOT NULL DEFAULT '',

  telefono text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  web text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',

  color_primario text NOT NULL DEFAULT '',
  color_ink text NOT NULL DEFAULT '',
  color_surface text NOT NULL DEFAULT '',
  logo_mime text,
  logo_base64 text,
  logo_oscuro_mime text,
  logo_oscuro_base64 text,
  logo_alto integer NOT NULL DEFAULT 48,

  landing jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS tenant_dominios (
  dominio text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tenant_dominios_tenant_idx ON tenant_dominios (tenant_id);
--> statement-breakpoint

-- Tenant por defecto: hereda todo lo que ya existe en la base. El nombre real,
-- los colores y los dominios los completa el bootstrap del arranque.
INSERT INTO tenants (slug, nombre)
SELECT 'default', 'Mi Empresa'
WHERE NOT EXISTS (SELECT 1 FROM tenants);
--> statement-breakpoint

-- ─── tenant_id en las tablas con datos de cada empresa ─────────
-- Se agrega nullable, se backfillea al tenant por defecto y recién después se
-- marca NOT NULL: así la migración corre sobre una base con datos.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE precios_referencia ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE ingestas ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
--> statement-breakpoint

UPDATE usuarios SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
--> statement-breakpoint
UPDATE proyectos SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
--> statement-breakpoint
UPDATE rubros SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
--> statement-breakpoint
UPDATE precios_referencia SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
--> statement-breakpoint
UPDATE ingestas SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
--> statement-breakpoint
UPDATE configuracion SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1) WHERE tenant_id IS NULL;
--> statement-breakpoint

ALTER TABLE usuarios ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE proyectos ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE rubros ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE precios_referencia ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE ingestas ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE configuracion ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint

-- ─── Unicidad por tenant ───────────────────────────────────────
-- El mismo email, código de proyecto o código de precio puede repetirse entre
-- empresas distintas; lo que no puede repetirse es dentro de una.

DROP INDEX IF EXISTS usuarios_email_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_tenant_email_idx ON usuarios (tenant_id, email);
--> statement-breakpoint
DROP INDEX IF EXISTS proyectos_codigo_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS proyectos_tenant_codigo_idx ON proyectos (tenant_id, codigo);
--> statement-breakpoint
DROP INDEX IF EXISTS proyectos_email_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS proyectos_tenant_email_idx ON proyectos (tenant_id, email);
--> statement-breakpoint
DROP INDEX IF EXISTS precios_referencia_codigo_desc_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS precios_referencia_tenant_codigo_desc_idx
  ON precios_referencia (tenant_id, codigo, descripcion);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rubros_tenant_idx ON rubros (tenant_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ingestas_tenant_idx ON ingestas (tenant_id);
--> statement-breakpoint

-- configuracion: la clave de costeo pasa a ser (tenant, clave)
ALTER TABLE configuracion DROP CONSTRAINT IF EXISTS configuracion_pkey;
--> statement-breakpoint
ALTER TABLE configuracion ADD PRIMARY KEY (tenant_id, clave);
