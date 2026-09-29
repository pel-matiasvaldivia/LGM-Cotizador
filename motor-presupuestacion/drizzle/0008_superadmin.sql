-- Rol de plataforma: quien administra las empresas del servicio (dar de alta un
-- tenant, asignarle dominios, crearle su primer admin).
--
-- Es una marca aparte del `rol`, que sigue siendo el rol DENTRO de una empresa:
-- un superadmin es además admin/comercial de la empresa por la que entra, y no
-- pierde ninguna de sus capacidades habituales.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS superadmin boolean NOT NULL DEFAULT false;
