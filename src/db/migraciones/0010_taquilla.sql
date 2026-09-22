-- La taquilla: movimientos, sesiones de turno, correcciones y delegaciones.
--
-- Escrita a mano. Drizzle exige un terminal interactivo para resolver ciertas
-- ambigüedades y no lo hay; además el disparador de inmutabilidad vive en
-- blindaje.sql, que se aplica después de las migraciones.

CREATE TYPE "public"."estado_comprobante" AS ENUM('pendiente', 'emitido');--> statement-breakpoint
CREATE TYPE "public"."operacion_delegable" AS ENUM('emitir_correccion');--> statement-breakpoint

CREATE TABLE "sesion_turno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"abierta_por" text NOT NULL,
	"abierta_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_en" timestamp with time zone,
	"programada_inicio" time NOT NULL,
	"programada_fin" time NOT NULL
);--> statement-breakpoint
ALTER TABLE "sesion_turno" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sesion_turno" ADD CONSTRAINT "sesion_turno_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id");--> statement-breakpoint
ALTER TABLE "sesion_turno" ADD CONSTRAINT "sesion_turno_turno_id_turno_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id");--> statement-breakpoint
ALTER TABLE "sesion_turno" ADD CONSTRAINT "sesion_turno_abierta_por_user_id_fk" FOREIGN KEY ("abierta_por") REFERENCES "public"."user"("id");--> statement-breakpoint
CREATE UNIQUE INDEX "sesion_una_abierta_por_persona" ON "sesion_turno" ("parqueadero_id","abierta_por") WHERE cerrada_en is null;--> statement-breakpoint
CREATE POLICY "sesion_turno_ambito" ON "sesion_turno" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "movimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"placa" text NOT NULL,
	"tipo_vehiculo_id" uuid NOT NULL,
	"entrada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"salida_en" timestamp with time zone,
	"operario_entrada" text NOT NULL,
	"operario_salida" text,
	"sesion_entrada" uuid,
	"sesion_salida" uuid,
	"importe" integer,
	"cobro" jsonb,
	"cortesia_motivo" text,
	"cortesia_por" text,
	"cortesia_importe_omitido" integer,
	"comprobante" "estado_comprobante" DEFAULT 'pendiente' NOT NULL,
	CONSTRAINT "movimiento_salida_coherente" CHECK (salida_en is null or salida_en > entrada_en),
	CONSTRAINT "movimiento_cerrado_completo" CHECK (salida_en is null
        or (cortesia_motivo is not null and importe = 0)
        or (importe is not null and cobro is not null)),
	CONSTRAINT "movimiento_cortesia_completa" CHECK ((cortesia_motivo is null and cortesia_por is null and cortesia_importe_omitido is null)
        or (cortesia_motivo is not null and cortesia_por is not null
            and cortesia_importe_omitido is not null and salida_en is not null)),
	CONSTRAINT "movimiento_importe_no_negativo" CHECK (importe is null or importe >= 0)
);--> statement-breakpoint
ALTER TABLE "movimiento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id");--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_tipo_vehiculo_id_tipo_vehiculo_id_fk" FOREIGN KEY ("tipo_vehiculo_id") REFERENCES "public"."tipo_vehiculo"("id");--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_operario_entrada_user_id_fk" FOREIGN KEY ("operario_entrada") REFERENCES "public"."user"("id");--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_operario_salida_user_id_fk" FOREIGN KEY ("operario_salida") REFERENCES "public"."user"("id");--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_sesion_entrada_sesion_turno_id_fk" FOREIGN KEY ("sesion_entrada") REFERENCES "public"."sesion_turno"("id");--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_sesion_salida_sesion_turno_id_fk" FOREIGN KEY ("sesion_salida") REFERENCES "public"."sesion_turno"("id");--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_cortesia_por_user_id_fk" FOREIGN KEY ("cortesia_por") REFERENCES "public"."user"("id");--> statement-breakpoint

-- La garantía de que una placa no está adentro dos veces. La impone el motor:
-- dos operarios simultáneos chocan acá, sin depender de que nadie consulte antes.
CREATE UNIQUE INDEX "movimiento_una_placa_adentro" ON "movimiento" ("parqueadero_id","placa") WHERE salida_en is null;--> statement-breakpoint
CREATE UNIQUE INDEX "movimiento_codigo_unico" ON "movimiento" ("parqueadero_id","codigo");--> statement-breakpoint
CREATE INDEX "movimiento_adentro" ON "movimiento" ("parqueadero_id") WHERE salida_en is null;--> statement-breakpoint
CREATE POLICY "movimiento_ambito" ON "movimiento" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "correccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"importe_corregido" integer NOT NULL,
	"motivo" text NOT NULL,
	"emitida_por" text NOT NULL,
	"emitida_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "correccion_importe_no_negativo" CHECK (importe_corregido >= 0),
	CONSTRAINT "correccion_motivo_no_vacio" CHECK (length(trim(motivo)) > 0)
);--> statement-breakpoint
ALTER TABLE "correccion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "correccion" ADD CONSTRAINT "correccion_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id");--> statement-breakpoint
ALTER TABLE "correccion" ADD CONSTRAINT "correccion_movimiento_id_movimiento_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimiento"("id");--> statement-breakpoint
ALTER TABLE "correccion" ADD CONSTRAINT "correccion_emitida_por_user_id_fk" FOREIGN KEY ("emitida_por") REFERENCES "public"."user"("id");--> statement-breakpoint
CREATE POLICY "correccion_ambito" ON "correccion" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint

CREATE TABLE "delegacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"operacion" "operacion_delegable" NOT NULL,
	"otorgada_por" text NOT NULL,
	"otorgada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"revocada_en" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "delegacion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delegacion" ADD CONSTRAINT "delegacion_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id");--> statement-breakpoint
ALTER TABLE "delegacion" ADD CONSTRAINT "delegacion_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id");--> statement-breakpoint
ALTER TABLE "delegacion" ADD CONSTRAINT "delegacion_otorgada_por_user_id_fk" FOREIGN KEY ("otorgada_por") REFERENCES "public"."user"("id");--> statement-breakpoint
CREATE UNIQUE INDEX "delegacion_una_vigente" ON "delegacion" ("parqueadero_id","usuario_id","operacion") WHERE revocada_en is null;--> statement-breakpoint
CREATE POLICY "delegacion_ambito" ON "delegacion" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);
