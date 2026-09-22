-- Corrección del modelo de fichas.
--
-- 0013 modeló la ficha como un TARJETÓN FÍSICO reutilizable: una tabla propia,
-- inventario, estados de vida y un cobro por reposición si no volvía. Está mal.
--
-- La ficha es simplemente el TICKET: el mismo papel que sale para un carro,
-- que en vez de una placa lleva un número. No hay tarjetón que devolver, así
-- que no hay nada que perder ni que dar de baja. Y cuántas hay no se declara
-- aparte: es la capacidad de bicicletas que el establecimiento ya declaró en
-- horario y capacidad. Un espacio de bicicleta es una ficha.
--
-- Va en migración aparte y no reescribiendo 0013 porque aquélla ya se aplicó, y
-- editar una migración aplicada la deja sin correr en la base que ya pasó por
-- ella mientras una base nueva sí la recibe.

-- El número de ficha pasa a ser una columna del movimiento, como la placa.
ALTER TABLE "movimiento" ADD COLUMN "ficha_numero" integer;--> statement-breakpoint

-- El nombre de quien deja la bicicleta. DATO PERSONAL: se purga como los otros.
ALTER TABLE "movimiento" ADD COLUMN "nombre" text;--> statement-breakpoint

-- Fuera lo que sobraba del modelo anterior.
DROP INDEX IF EXISTS "movimiento_una_ficha_afuera";--> statement-breakpoint
ALTER TABLE "movimiento" DROP CONSTRAINT IF EXISTS "movimiento_un_identificador";--> statement-breakpoint
ALTER TABLE "movimiento" DROP CONSTRAINT IF EXISTS "movimiento_ficha_id_ficha_id_fk";--> statement-breakpoint
ALTER TABLE "movimiento" DROP COLUMN IF EXISTS "ficha_id";--> statement-breakpoint
ALTER TABLE "movimiento" DROP COLUMN IF EXISTS "ficha_perdida";--> statement-breakpoint

DROP TABLE IF EXISTS "ficha";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."estado_ficha";--> statement-breakpoint

ALTER TABLE "politica_cobro" DROP CONSTRAINT IF EXISTS "politica_reposicion_no_negativa";--> statement-breakpoint
ALTER TABLE "politica_cobro" DROP COLUMN IF EXISTS "reposicion_ficha";--> statement-breakpoint

-- LA GARANTÍA, ahora sobre el número. Misma técnica que la placa y por la misma
-- razón: dos recepciones simultáneas chocan en la base, sin depender de que
-- nadie haya consultado antes.
CREATE UNIQUE INDEX "movimiento_una_ficha_afuera"
  ON "movimiento" ("parqueadero_id","ficha_numero") WHERE salida_en is null;--> statement-breakpoint

-- Un movimiento se identifica de UNA sola manera: placa o número de ficha.
ALTER TABLE "movimiento"
  ADD CONSTRAINT "movimiento_un_identificador"
  CHECK ((placa is not null and ficha_numero is null)
      or (placa is null and ficha_numero is not null and ficha_numero >= 1));
