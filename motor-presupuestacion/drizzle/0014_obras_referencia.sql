-- Obras de referencia: el despiece deja de subirse y pasa a proponerse.
--
-- La plataforma ya sabe la geometría de la obra (luz, largo, altura, m²,
-- tipología) desde que el cliente cotiza. Lo que no sabía es cuántos kilos de
-- cada perfil lleva eso, porque ese dato vive en la cabeza de oficina técnica
-- y en las estructuras de producto que arman a mano.
--
-- Acá se guardan esas estructuras como PATRONES. Cada despiece que se carga
-- contra un proyecto con geometría conocida queda disponible como obra de
-- referencia, y el motor de explosión escala la más parecida.
--
-- Por qué escalar una obra y no promediar varias: promediar mezcla juegos de
-- perfiles distintos y produce un despiece que nunca existió —medio W410 y
-- medio W360 en la misma viga—. Oficina técnica estima tomando la obra más
-- parecida que ya hizo, y eso es lo que el motor reproduce.

CREATE TABLE IF NOT EXISTS obras_referencia (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
	-- De qué proyecto salió, cuando salió de uno. Las obras viejas se cargan
	-- por script y no tienen proyecto.
	proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,

	nombre text NOT NULL,
	-- Geometría de la obra que produjo este despiece: es el denominador.
	tipologia text NOT NULL DEFAULT '',
	ancho double precision NOT NULL DEFAULT 0,
	largo double precision NOT NULL DEFAULT 0,
	altura_libre double precision NOT NULL DEFAULT 0,
	superficie double precision NOT NULL,
	tipo_cubierta text NOT NULL DEFAULT '',
	tipo_cerramiento text NOT NULL DEFAULT '',

	-- Se puede apagar sin borrarla: una obra mal cargada deja de usarse como
	-- patrón pero no se pierde.
	activa boolean NOT NULL DEFAULT true,
	notas text NOT NULL DEFAULT '',

	cargada_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS obras_referencia_tenant_idx ON obras_referencia (tenant_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS obras_referencia_items (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	obra_id uuid NOT NULL REFERENCES obras_referencia(id) ON DELETE CASCADE,

	subconjunto text NOT NULL DEFAULT '',
	codigo text NOT NULL DEFAULT '',
	descripcion text NOT NULL,
	unidad text NOT NULL DEFAULT '',
	cantidad double precision NOT NULL DEFAULT 0,

	-- Sobre qué escala este renglón al llevarlo a otra obra:
	--   m2_cubierta  · superficie en planta (estructura, correas, cubierta)
	--   m2_lateral   · perímetro × altura libre (cierre lateral, tensores)
	--   ml_perimetro · perímetro (zinguería, canaletas, veredín)
	--   unidad_porton· cantidad de portones
	--   global       · no escala (una escalera es una escalera)
	base text NOT NULL DEFAULT 'm2_cubierta',
	orden integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS obras_referencia_items_idx ON obras_referencia_items (obra_id);
--> statement-breakpoint

-- De dónde salió cada renglón del despiece de una orden: generado por el
-- motor, importado del ERP o cargado a mano. Ya existía como `origen`; acá se
-- agrega de qué obra de referencia se escaló, para poder explicar el número.
ALTER TABLE materiales_orden ADD COLUMN IF NOT EXISTS obra_referencia_id uuid
	REFERENCES obras_referencia(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE materiales_orden ADD COLUMN IF NOT EXISTS factor_escala double precision;
