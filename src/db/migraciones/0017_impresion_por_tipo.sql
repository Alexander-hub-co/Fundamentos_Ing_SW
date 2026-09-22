-- Imprimir la entrada y la salida se deciden por separado.
--
-- Antes era un solo interruptor para las dos cosas. Son decisiones distintas:
-- el ticket de entrada es el resguardo que el cliente se lleva y casi siempre
-- se quiere; el de salida es el recibo de lo que pagó, y hay parqueaderos que
-- sólo lo dan si se lo piden. Un solo interruptor obligaba a elegir entre
-- gastar papel de más o quedarse sin resguardo.
--
-- `imprimir_auto` se renombra en vez de crearse de nuevo, para que lo que cada
-- cuenta ya había elegido se conserve.

ALTER TABLE "preferencia_usuario"
  RENAME COLUMN "imprimir_auto" TO "imprimir_entrada";--> statement-breakpoint

ALTER TABLE "preferencia_usuario"
  ADD COLUMN "imprimir_salida" boolean DEFAULT false NOT NULL;
