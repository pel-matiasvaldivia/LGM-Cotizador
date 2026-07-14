-- P3+: propagar el desglose real de mano de obra (Fabricación vs Montaje)
-- desde el ratio hasta los ítems del presupuesto, para exportarlo a Flexxus
-- en sus subrubros correctos (p. ej. Estructura 347 Fab / 348 Montaje).

ALTER TABLE "presupuesto_base_items" ADD COLUMN "costo_mo_fab_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "presupuesto_base_items" ADD COLUMN "costo_mo_montaje_usd" double precision DEFAULT 0 NOT NULL;
