-- Vacía a propósito.
--
-- El valor 'primera_hora_y_fraccion' del enum `modelo_cobro` se agrega en el
-- paso 2 de `migrar.ts`, ANTES de las migraciones de Drizzle. PostgreSQL
-- prohíbe usar un valor de enum en la misma transacción que lo crea, y Drizzle
-- envuelve todas sus migraciones en una sola: el CHECK de la migración
-- siguiente lo menciona, así que desde acá no hay forma de que funcione.
SELECT 1;
