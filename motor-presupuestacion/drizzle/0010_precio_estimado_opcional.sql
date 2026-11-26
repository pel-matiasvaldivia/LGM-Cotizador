-- El precio orientativo en vivo del cotizador es una decisión comercial, no
-- una característica del producto: hay empresas que prefieren no mostrar
-- ningún número antes de que lo revise un comercial.
--
-- Por defecto queda encendido, que es como venía funcionando hasta ahora.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS mostrar_precio_estimado boolean NOT NULL DEFAULT true;
