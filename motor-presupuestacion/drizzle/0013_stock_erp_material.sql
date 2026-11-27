-- Existencia que trae la exportación del ERP para cada artículo.
--
-- La estructura de producto exportada incluye la columna Stock. No es una
-- reserva para la obra —es el stock general del artículo, y puede estar
-- desactualizado o en negativo— pero sirve como punto de partida de la
-- verificación en vez de tipear a mano cincuenta números.
--
-- NULL = la exportación no lo traía, o venía de una exportación con las
-- columnas corridas y no se puede confiar en el número.
ALTER TABLE materiales_orden ADD COLUMN IF NOT EXISTS stock_erp double precision;
