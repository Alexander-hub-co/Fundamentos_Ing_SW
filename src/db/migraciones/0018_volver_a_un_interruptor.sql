-- Se deshace el desdoble de 0017.
--
-- Aquélla partió la impresión automática en dos interruptores, uno para la
-- entrada y otro para la salida. Era más de lo que hacía falta: la decisión de
-- imprimir el recibo se toma EN LA SALIDA, con el cliente delante, no una vez
-- en una pantalla de ajustes. Vuelve el interruptor único, y la salida se
-- pregunta en el momento.
--
-- Migración aparte y no reescritura de 0017, por lo de siempre: aquélla ya se
-- aplicó, y editarla la dejaría sin correr en la base que ya pasó por ella
-- mientras una base nueva sí la recibe.

ALTER TABLE "preferencia_usuario" DROP COLUMN IF EXISTS "imprimir_salida";--> statement-breakpoint

ALTER TABLE "preferencia_usuario"
  RENAME COLUMN "imprimir_entrada" TO "imprimir_auto";
