-- Tope de cordura sobre el número de ficha.
--
-- Va en migración aparte y no dentro de 0013 porque aquella YA se aplicó.
-- Editar una migración aplicada no la vuelve a correr: la base que ya la pasó
-- se queda sin el cambio mientras una base nueva sí lo recibe, y las dos
-- divergen en silencio. Es el error que esta separación evita.
--
-- El número vive junto a la tabla y no en el dominio por el Principio II, que
-- prohíbe literalmente "un literal numérico de precio, duración de cobro o
-- cantidad de fichas en el código fuente". No es un parámetro de negocio
-- disfrazado: no dice cuántas fichas debe tener un parqueadero —eso lo decide
-- cada uno— sino que protege de un cero de más al escribir.

ALTER TABLE "ficha"
  ADD CONSTRAINT "ficha_numero_razonable" CHECK ("numero" <= 500);
