-- Preferencias de impresión de la taquilla.
--
-- Escrita a mano, como las anteriores: drizzle-kit exige un terminal
-- interactivo y acá no lo hay.
--
-- Las dos columnas nacen con valor por defecto, así que las filas que ya
-- existen quedan coherentes sin tocarlas. `imprimir_auto` arranca apagado a
-- propósito: hasta que alguien compruebe que la impresora de esa caseta
-- responde, encenderlo sólo produce diálogos delante de un cliente.

ALTER TABLE "preferencia_usuario"
  ADD COLUMN "imprimir_auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "preferencia_usuario"
  ADD COLUMN "ancho_rollo" integer DEFAULT 58 NOT NULL;--> statement-breakpoint

ALTER TABLE "preferencia_usuario"
  ADD CONSTRAINT "preferencia_rollo_conocido" CHECK ("ancho_rollo" in (58, 80));
