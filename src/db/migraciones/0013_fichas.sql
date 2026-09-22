-- Bicicletas y fichas (F4).
--
-- Escrita a mano, como las anteriores: drizzle-kit exige un terminal
-- interactivo y acá no lo hay.
--
-- El cambio más invasivo es volver NULA la columna de placa. Se hace de una vez
-- y temprano, con la suite completa como red, para que lo que dé por hecho que
-- la placa existe se rompa ahora y no a mitad de la funcionalidad. Los
-- movimientos que ya hay quedan intactos: todos tienen placa y ninguno tiene
-- ficha, que es exactamente lo que el CHECK nuevo exige.

CREATE TYPE "public"."estado_ficha" AS ENUM('activa', 'perdida', 'dada_de_baja');--> statement-breakpoint

CREATE TABLE "ficha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"estado" "estado_ficha" DEFAULT 'activa' NOT NULL,
	"nota" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ficha_numero_positivo" CHECK ("numero" >= 1)
);--> statement-breakpoint

ALTER TABLE "ficha" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "ficha"
  ADD CONSTRAINT "ficha_parqueadero_id_parqueadero_id_fk"
  FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE POLICY "ficha_ambito" ON "ficha" AS PERMISSIVE FOR ALL TO public
  USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid)
  WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint

CREATE UNIQUE INDEX "ficha_numero_unico" ON "ficha" ("parqueadero_id","numero");--> statement-breakpoint
CREATE INDEX "ficha_activa" ON "ficha" ("parqueadero_id") WHERE estado = 'activa';--> statement-breakpoint

-- --------------------------------------------------------------------------
-- movimiento: identificar también por ficha
-- --------------------------------------------------------------------------

ALTER TABLE "movimiento" ALTER COLUMN "placa" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "movimiento" ADD COLUMN "ficha_id" uuid;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "cedula" text;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "nota_vehiculo" text;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "ficha_perdida" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "movimiento"
  ADD CONSTRAINT "movimiento_ficha_id_ficha_id_fk"
  FOREIGN KEY ("ficha_id") REFERENCES "public"."ficha"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Un movimiento se identifica de UNA sola manera. Permitir las dos abriría la
-- pregunta de cuál manda; no tener ninguna dejaría un movimiento que nadie
-- puede reclamar.
ALTER TABLE "movimiento"
  ADD CONSTRAINT "movimiento_un_identificador"
  CHECK ((placa is not null and ficha_id is null) or (placa is null and ficha_id is not null));--> statement-breakpoint

-- LA GARANTÍA de que dos operarios no entreguen la misma ficha. Misma técnica
-- que movimiento_una_placa_adentro y por la misma razón: comprobar y después
-- insertar deja una rendija entre lo uno y lo otro.
CREATE UNIQUE INDEX "movimiento_una_ficha_afuera"
  ON "movimiento" ("parqueadero_id","ficha_id") WHERE salida_en is null;--> statement-breakpoint

-- La búsqueda de quien perdió el tarjetón.
CREATE INDEX "movimiento_por_cedula"
  ON "movimiento" ("parqueadero_id","cedula") WHERE salida_en is null;--> statement-breakpoint

-- --------------------------------------------------------------------------
-- Lo que cuesta reponer un tarjetón perdido
-- --------------------------------------------------------------------------
-- Va a la política de cobro del establecimiento y no quemado en el código
-- porque toca dinero, que es lo que el Principio II reserva al establecimiento.
-- Cero por defecto: cobrar por el tarjetón es una decisión, no un supuesto.

ALTER TABLE "politica_cobro"
  ADD COLUMN "reposicion_ficha" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "politica_cobro"
  ADD CONSTRAINT "politica_reposicion_no_negativa" CHECK ("reposicion_ficha" >= 0);
