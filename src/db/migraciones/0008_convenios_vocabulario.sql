-- Convenios: del porcentaje único al vocabulario componible.
--
-- Escrita a mano y no generada. Drizzle no puede decidir por su cuenta si
-- `descuento_pct` se renombró a `valor` o si desapareció y nació otra columna,
-- y sobre todo no sabe traducir los datos. Se hace todo en una sola migración
-- para que no exista un estado intermedio en el que las dos representaciones
-- convivan y alguien tenga que acordarse de cuál es la buena.

CREATE TYPE "public"."activacion_convenio" AS ENUM('sello', 'placa');--> statement-breakpoint
CREATE TYPE "public"."beneficio_convenio" AS ENUM('minutos_gratis', 'porcentaje', 'tarifa_fija', 'sin_cobro');--> statement-breakpoint
CREATE TYPE "public"."regla_redondeo" AS ENUM('peso', 'cincuentena', 'centena');--> statement-breakpoint

-- Las columnas nacen NULABLES a propósito: hay que poder traducir las filas
-- existentes antes de exigir que estén llenas.
ALTER TABLE "convenio" ADD COLUMN "activacion" "activacion_convenio";--> statement-breakpoint
ALTER TABLE "convenio" ADD COLUMN "beneficio" "beneficio_convenio";--> statement-breakpoint
ALTER TABLE "convenio" ADD COLUMN "valor" integer;--> statement-breakpoint
ALTER TABLE "convenio" ADD COLUMN "tope_pesos" integer;--> statement-breakpoint
ALTER TABLE "convenio" ADD COLUMN "limite_diario" integer;--> statement-breakpoint
ALTER TABLE "convenio" ADD COLUMN "creado_por" text;--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- La traducción. Todo convenio anterior era un porcentaje sobre una lista de
-- placas, así que su equivalente exacto en el vocabulario nuevo es activación
-- por placa con beneficio de porcentaje.
--
-- El porcentaje viejo admitía cero y el nuevo exige al menos uno: un convenio
-- del 0 % no descontaba nada, así que se conserva como el mínimo expresable en
-- vez de perderse. Son datos de clientes, no un ensayo.
UPDATE "convenio" SET
  "activacion" = 'placa',
  "beneficio"  = 'porcentaje',
  "valor"      = GREATEST("descuento_pct", 1);--> statement-breakpoint

ALTER TABLE "convenio" ALTER COLUMN "activacion" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "convenio" ALTER COLUMN "beneficio" SET NOT NULL;--> statement-breakpoint

-- Ya traducido, el porcentaje viejo y su restricción sobran.
ALTER TABLE "convenio" DROP CONSTRAINT IF EXISTS "convenio_descuento_valido";--> statement-breakpoint
ALTER TABLE "convenio" DROP COLUMN "descuento_pct";--> statement-breakpoint

-- Cada beneficio exige lo suyo y prohíbe lo ajeno. La validación vive en el
-- motor: no hay forma de escribir un convenio incoherente, ni desde la
-- aplicación ni desde una consulta a mano.
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_parametros_del_beneficio" CHECK ((
        beneficio = 'minutos_gratis' and valor is not null and valor > 0
      ) or (
        beneficio = 'porcentaje' and valor is not null and valor between 1 and 100
      ) or (
        beneficio = 'tarifa_fija' and valor is not null and valor >= 0
      ) or (
        beneficio = 'sin_cobro' and valor is null
      ));--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_tope_valido" CHECK (tope_pesos is null or tope_pesos > 0);--> statement-breakpoint

-- El cero se rechaza en el motor y no sólo en el formulario: un convenio que no
-- puede aplicarse nunca no es uno limitado sino uno desactivado, y para eso ya
-- existe la columna `activo`.
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_limite_valido" CHECK (limite_diario is null or limite_diario >= 1);--> statement-breakpoint

-- Cómo redondea cada establecimiento. A lo sumo una fila; la ausencia significa
-- el valor inicial, igual que un establecimiento sin horario se trata como
-- abierto veinticuatro horas.
CREATE TABLE "politica_cobro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"redondeo" "regla_redondeo" NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "politica_cobro_parqueadero_id_unique" UNIQUE("parqueadero_id")
);--> statement-breakpoint
ALTER TABLE "politica_cobro" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politica_cobro" ADD CONSTRAINT "politica_cobro_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "politica_cobro_ambito" ON "politica_cobro" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);
