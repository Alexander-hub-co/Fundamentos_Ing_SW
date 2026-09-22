-- Migración fundacional de Parquivo.
--
-- Contiene lo que Drizzle no puede declarar desde el esquema TypeScript y que
-- resulta indispensable para que el Principio I sea real:
--
--   1. Los tres roles de base de datos, con sus privilegios diferenciados.
--   2. FORCE ROW LEVEL SECURITY, sin el cual el dueño de la tabla ignora las
--      políticas y todo el diseño queda anulado en silencio.
--   3. El disparador que hace inmutable el código del establecimiento.
--
-- Corre DESPUÉS de las migraciones de Drizzle, porque otorga permisos y activa
-- RLS sobre tablas que aquellas crean.
--
-- Los roles NO se crean aquí: sus contraseñas son secretos y este archivo está
-- versionado. Los crea `src/db/migrar.ts` leyéndolas del entorno.

-- ---------------------------------------------------------------------------
-- 1. Permisos
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO app_tenant, app_platform;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO app_tenant, app_platform;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO app_tenant, app_platform;

-- Que las tablas futuras hereden los permisos sin intervención manual.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant, app_platform;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_tenant, app_platform;

-- ---------------------------------------------------------------------------
-- 2. FORCE ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- Sin esto, el dueño de la tabla ignora las políticas. Es la trampa que
-- convierte un diseño correcto en una fuga silenciosa.

-- Se recorre en vez de enumerarse. Cuando F1 lo escribió había dos tablas y la
-- lista alcanzaba; F2 agregó nueve y la lista se habría quedado corta en
-- silencio, que es exactamente la clase de fuga que esta sección evita. Ahora
-- toda tabla con RLS habilitada queda forzada, incluidas las que vengan.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity          -- tiene RLS habilitada
       AND NOT c.relforcerowsecurity -- pero no forzada
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'FORCE RLS aplicado a %', t.relname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Inmutabilidad del código (FR-015)
-- ---------------------------------------------------------------------------
-- "Inmutable durante toda la vida del establecimiento" debe sobrevivir a
-- cualquier código futuro, así que se impone en la base y no en la aplicación.

CREATE OR REPLACE FUNCTION parqueadero_codigo_inmutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION 'El código del parqueadero es inmutable (FR-015): % → %',
      OLD.codigo, NEW.codigo
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parqueadero_codigo_inmutable_trg ON parqueadero;
CREATE TRIGGER parqueadero_codigo_inmutable_trg
  BEFORE UPDATE ON parqueadero
  FOR EACH ROW
  EXECUTE FUNCTION parqueadero_codigo_inmutable();

-- ---------------------------------------------------------------------------
-- 4. Guardia contra tablas de tenencia sin política (T044)
-- ---------------------------------------------------------------------------
-- Si mañana alguien añade una tabla con columna `parqueadero_id` y olvida su
-- política RLS, esta comprobación hace fallar la migración en vez de dejar
-- pasar el agujero.

DO $$
DECLARE
  sin_politica text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO sin_politica
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'parqueadero_id'
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attnum > 0
    AND NOT c.relrowsecurity
    -- `acceso_denegado` sigue exenta y no por olvido: su columna de ámbito se
      -- llama `parqueadero_ambito`, no `parqueadero_id`, porque anota el ámbito
      -- DESDE el que se intentó alcanzar algo ajeno. Es auditoría de plataforma,
      -- no dato de un establecimiento. `cambio_estado` sí tenía ámbito real y
      -- dejó de estar exenta en F2.
      AND c.relname NOT IN ('acceso_denegado');

  IF sin_politica IS NOT NULL THEN
    RAISE EXCEPTION
      'Tablas con parqueadero_id sin RLS habilitada: %. Ver Principio I.',
      sin_politica;
  END IF;
END
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- Un movimiento cerrado no se modifica ni se borra (Principio IV)
--
-- Esto NO se deja al código de la aplicación. La constitución dice que un
-- movimiento finalizado nunca se modifica ni se elimina físicamente, y una
-- garantía que depende de que quien escriba la próxima consulta se acuerde no
-- es una garantía: es una intención.
--
-- Se permiten dos cosas sobre una fila cerrada, y sólo dos:
--   · marcar el comprobante como emitido, porque eso no toca ni el dinero ni
--     las horas ni quién atendió, y ocurre después de cerrar por diseño;
--   · nada más.
--
-- Corregir un cobro NO es modificar el movimiento: es escribir un asiento en
-- `correccion` que lo referencia y conserva los dos importes.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION movimiento_cerrado_es_inmutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Exento el rol DUEÑO de las tablas, y sólo él. No es una puerta trasera para
  -- la aplicación: `app_migrator` no aparece en ninguna ruta de código, sólo
  -- corre migraciones y mantenimiento. Los dos roles que la aplicación sí usa
  -- —`app_tenant` en toda operación de establecimiento y `app_platform` en la
  -- puerta privilegiada— quedan atados sin excepción.
  --
  -- Sin esta salida el dato sería imborrable incluso para desmantelar una base
  -- o limpiar entre pruebas, y una garantía que impide operar acaba
  -- desactivada entera, que es peor.
  IF current_user = (
    SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = TG_RELID
  ) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Un movimiento no se elimina (Principio IV). Para corregir un cobro se emite un asiento en correccion.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Sobre una fila abierta se puede escribir con libertad: todavía no es
  -- historial, es un vehículo que está adentro.
  IF OLD.salida_en IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cerrada: sólo cambia el estado del comprobante.
  -- Comparación explícita, columna por columna, de todo lo que no puede
  -- cambiar. Es más larga que un ROW(...) genérico y es a propósito: si mañana
  -- se agrega una columna, hay que decidir conscientemente si es inmutable, en
  -- vez de que se cuele por omisión.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.parqueadero_id IS DISTINCT FROM OLD.parqueadero_id
     OR NEW.codigo IS DISTINCT FROM OLD.codigo
     OR NEW.placa IS DISTINCT FROM OLD.placa
     OR NEW.tipo_vehiculo_id IS DISTINCT FROM OLD.tipo_vehiculo_id
     OR NEW.entrada_en IS DISTINCT FROM OLD.entrada_en
     OR NEW.salida_en IS DISTINCT FROM OLD.salida_en
     OR NEW.operario_entrada IS DISTINCT FROM OLD.operario_entrada
     OR NEW.operario_salida IS DISTINCT FROM OLD.operario_salida
     OR NEW.sesion_entrada IS DISTINCT FROM OLD.sesion_entrada
     OR NEW.sesion_salida IS DISTINCT FROM OLD.sesion_salida
     OR NEW.importe IS DISTINCT FROM OLD.importe
     OR NEW.cobro IS DISTINCT FROM OLD.cobro
     OR NEW.cortesia_motivo IS DISTINCT FROM OLD.cortesia_motivo
     OR NEW.cortesia_por IS DISTINCT FROM OLD.cortesia_por
     OR NEW.cortesia_importe_omitido IS DISTINCT FROM OLD.cortesia_importe_omitido
    THEN
    RAISE EXCEPTION
      'Un movimiento cerrado no se modifica (Principio IV). Sólo puede cambiar el estado del comprobante; para corregir un cobro se emite un asiento en correccion.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS movimiento_inmutable ON movimiento;
CREATE TRIGGER movimiento_inmutable
  BEFORE UPDATE OR DELETE ON movimiento
  FOR EACH ROW
  EXECUTE FUNCTION movimiento_cerrado_es_inmutable();
