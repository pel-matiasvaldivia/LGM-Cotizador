CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datos_tecnicos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"ancho" double precision,
	"largo" double precision,
	"superficie" double precision,
	"altura_libre" double precision,
	"tipologia" text,
	"tipo_cubierta" text,
	"tipo_cerramiento" text,
	"incluye_fabricacion" boolean DEFAULT true NOT NULL,
	"incluye_montaje" boolean DEFAULT true NOT NULL,
	"incluye_cubierta" boolean DEFAULT true NOT NULL,
	"incluye_cerramiento_lateral" boolean DEFAULT false NOT NULL,
	"incluye_portones" boolean DEFAULT false NOT NULL,
	"incluye_piso" boolean DEFAULT false NOT NULL,
	"incluye_electrica" boolean DEFAULT false NOT NULL,
	"incluye_sanitaria" boolean DEFAULT false NOT NULL,
	"cantidad_portones" integer,
	"especificaciones_adicionales" text,
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canal" text NOT NULL,
	"raw_content" text DEFAULT '' NOT NULL,
	"variables_extraidas" jsonb,
	"procesado" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presupuesto_base_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"rubro_id" uuid,
	"subrubro_id" uuid,
	"descripcion" text DEFAULT '' NOT NULL,
	"unidad" text DEFAULT '' NOT NULL,
	"cantidad" double precision DEFAULT 0 NOT NULL,
	"precio_unitario_ars" double precision DEFAULT 0 NOT NULL,
	"precio_unitario_usd" double precision DEFAULT 0 NOT NULL,
	"costo_total_ars" double precision DEFAULT 0 NOT NULL,
	"costo_total_usd" double precision DEFAULT 0 NOT NULL,
	"margen" double precision DEFAULT 0.2 NOT NULL,
	"precio_venta_ars" double precision DEFAULT 0 NOT NULL,
	"precio_venta_usd" double precision DEFAULT 0 NOT NULL,
	"incluido" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proyectos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"cliente" text NOT NULL,
	"razon_social" text,
	"contacto" text,
	"dni" text,
	"telefono" text,
	"email" text,
	"ubicacion" text,
	"canal_origen" text DEFAULT 'manual' NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratios_costos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subrubro_id" uuid NOT NULL,
	"unidad" text NOT NULL,
	"ratio_cantidad" double precision DEFAULT 0 NOT NULL,
	"precio_unitario_ars" double precision DEFAULT 0 NOT NULL,
	"precio_unitario_usd" double precision DEFAULT 0 NOT NULL,
	"vigente" boolean DEFAULT true NOT NULL,
	"fecha_actualizacion" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"codigo_flexxus" integer DEFAULT 0 NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subrubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rubro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"codigo_flexxus" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"nombre" text DEFAULT '' NOT NULL,
	"rol" text DEFAULT 'cliente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "datos_tecnicos" ADD CONSTRAINT "datos_tecnicos_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_base_items" ADD CONSTRAINT "presupuesto_base_items_proyecto_id_proyectos_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyectos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_base_items" ADD CONSTRAINT "presupuesto_base_items_rubro_id_rubros_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_base_items" ADD CONSTRAINT "presupuesto_base_items_subrubro_id_subrubros_id_fk" FOREIGN KEY ("subrubro_id") REFERENCES "public"."subrubros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratios_costos" ADD CONSTRAINT "ratios_costos_subrubro_id_subrubros_id_fk" FOREIGN KEY ("subrubro_id") REFERENCES "public"."subrubros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subrubros" ADD CONSTRAINT "subrubros_rubro_id_rubros_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "datos_tecnicos_proyecto_idx" ON "datos_tecnicos" USING btree ("proyecto_id");--> statement-breakpoint
CREATE INDEX "presupuesto_items_proyecto_idx" ON "presupuesto_base_items" USING btree ("proyecto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proyectos_codigo_idx" ON "proyectos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "proyectos_email_idx" ON "proyectos" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_idx" ON "usuarios" USING btree ("email");