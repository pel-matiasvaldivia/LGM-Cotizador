-- P1/P2: costeo con Material vs Mano de Obra, incidencia y logística por distancia.

-- ratios: separar precio en Material y Mano de Obra (fabricación + montaje), en USD
ALTER TABLE "ratios_costos" ADD COLUMN "precio_material_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ratios_costos" ADD COLUMN "precio_mo_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- migrar filas existentes: tratar el precio actual como 100% material (comportamiento neutro)
UPDATE "ratios_costos" SET "precio_material_usd" = "precio_unitario_usd" WHERE "precio_material_usd" = 0 AND "precio_unitario_usd" > 0;--> statement-breakpoint

-- items del presupuesto: costo desglosado + incidencia (% del costo directo)
ALTER TABLE "presupuesto_base_items" ADD COLUMN "costo_material_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "presupuesto_base_items" ADD COLUMN "costo_mo_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "presupuesto_base_items" ADD COLUMN "incidencia" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint

-- datos técnicos: distancia a obra para el cálculo de logística/fletes
ALTER TABLE "datos_tecnicos" ADD COLUMN "distancia_obra_km" double precision;
