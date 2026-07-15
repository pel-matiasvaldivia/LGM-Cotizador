-- Biblioteca de precios de referencia (Revista Cifras / Hoja 2 del modelo de
-- costos). Costos unitarios directos por ítem (material + ejecución) que el
-- comercial consulta para agregar o ajustar rubros/subrubros al editar una
-- cotización Base 0 en borrador.
CREATE TABLE IF NOT EXISTS precios_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT '',
  codigo text NOT NULL DEFAULT '',
  descripcion text NOT NULL,
  unidad text NOT NULL DEFAULT '',
  costo_material_usd double precision NOT NULL DEFAULT 0,
  costo_ejecucion_usd double precision NOT NULL DEFAULT 0,
  costo_total_usd double precision NOT NULL DEFAULT 0,
  fuente text NOT NULL DEFAULT 'Revista Cifras',
  activo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Clave natural para upsert idempotente al re-importar la planilla.
CREATE UNIQUE INDEX IF NOT EXISTS precios_referencia_codigo_desc_idx
  ON precios_referencia (codigo, descripcion);

-- Origen del ítem del presupuesto: 'base0' lo genera el motor (se reemplaza en
-- cada recálculo); 'manual' lo agregó el comercial (sobrevive al recálculo).
ALTER TABLE presupuesto_base_items
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'base0';
