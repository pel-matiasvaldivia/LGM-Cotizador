-- Verificación del email en el portal del cliente.
--
-- El portal muestra los presupuestos cuyo email coincide con el de la cuenta.
-- Como el registro es público, hasta ahora alcanzaba con registrarse usando el
-- email de otro para ver su cotización. Ahora una cuenta de cliente no ve nada
-- hasta confirmar que el email es suyo.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado_at timestamptz;
--> statement-breakpoint
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verificacion_token_hash text;
--> statement-breakpoint
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verificacion_expira timestamptz;
--> statement-breakpoint

-- Las cuentas que ya existen quedan verificadas: el staff lo crea un admin (no
-- hay nada que verificar) y a los clientes actuales no se los deja afuera de un
-- día para el otro. La exigencia rige para las cuentas nuevas.
UPDATE usuarios SET email_verificado_at = created_at WHERE email_verificado_at IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS usuarios_verificacion_token_idx
  ON usuarios (verificacion_token_hash)
  WHERE verificacion_token_hash IS NOT NULL;
