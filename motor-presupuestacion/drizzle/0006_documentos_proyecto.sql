CREATE TABLE IF NOT EXISTS documentos_proyecto (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
	nombre text NOT NULL,
	tipo_mime text NOT NULL DEFAULT '',
	tamano_bytes integer NOT NULL DEFAULT 0,
	contenido_base64 text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS documentos_proyecto_idx ON documentos_proyecto (proyecto_id);
