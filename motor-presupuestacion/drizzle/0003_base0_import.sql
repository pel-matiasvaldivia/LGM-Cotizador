-- P3: importador de Base 0. Preserva el desglose real de mano de obra
-- (Fabricación vs Montaje) por ratio, tal como viene en la planilla Base 0.

ALTER TABLE "ratios_costos" ADD COLUMN "precio_mo_fab_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ratios_costos" ADD COLUMN "precio_mo_montaje_usd" double precision DEFAULT 0 NOT NULL;
