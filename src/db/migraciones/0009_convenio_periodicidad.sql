-- Vigencias declaradas por su nombre.
--
-- Un administrador piensa en "la mensualidad del vecino", no en "vence el 19 de
-- septiembre". Guardar la duración ADEMÁS de la fecha conserva esa intención:
-- sin la columna, la lista mostraría una fecha suelta y nadie reconocería el
-- acuerdo.

CREATE TYPE "public"."periodicidad_convenio" AS ENUM('mensual', 'trimestral', 'semestral', 'anual');--> statement-breakpoint

-- Nulable: la mayoría de los convenios no son de larga duración, y los que ya
-- existen no lo son en absoluto.
ALTER TABLE "convenio" ADD COLUMN "periodicidad" "periodicidad_convenio";--> statement-breakpoint

-- Una mensualidad que no vence no es una mensualidad.
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_periodicidad_vence" CHECK (periodicidad is null or hasta is not null);
