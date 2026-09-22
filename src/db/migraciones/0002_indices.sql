-- Índices de consulta.
--
-- Se añaden a mano y no por el generador porque responden a patrones de acceso
-- concretos, no a la forma del esquema:
--
--   asignacion.parqueadero_id  — la política RLS filtra por esta columna en
--                                CADA consulta con ámbito. Sin índice, el
--                                aislamiento cuesta un recorrido completo.
--   parqueadero.estado         — el panel agrupa por estado y el listado filtra.
--   intento_login.email_...    — ya existe uno compuesto; este cubre la consulta
--                                por correo sin rango de fechas.

CREATE INDEX IF NOT EXISTS asignacion_parqueadero_idx
  ON asignacion (parqueadero_id);

CREATE INDEX IF NOT EXISTS parqueadero_estado_idx
  ON parqueadero (estado);

CREATE INDEX IF NOT EXISTS intento_login_email_idx
  ON intento_login (email_intentado);

CREATE INDEX IF NOT EXISTS asignacion_rol_idx
  ON asignacion (rol);
