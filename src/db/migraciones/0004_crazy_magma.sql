CREATE TYPE "public"."alcance_plena" AS ENUM('estadia', 'jornada');--> statement-breakpoint
CREATE TYPE "public"."modelo_cobro" AS ENUM('por_minuto', 'por_intervalo');--> statement-breakpoint
CREATE TABLE "tipo_vehiculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"modelo_sugerido" "modelo_cobro" NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tipo_vehiculo_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "tarifa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"tipo_vehiculo_id" uuid NOT NULL,
	"modelo" "modelo_cobro" NOT NULL,
	"tarifa_minima" integer,
	"valor_minuto" integer,
	"intervalo_minutos" integer,
	"valor_intervalo" integer,
	"tarifa_plena" integer NOT NULL,
	"alcance_plena" "alcance_plena" NOT NULL,
	"vigente_desde" timestamp with time zone DEFAULT now() NOT NULL,
	"vigente_hasta" timestamp with time zone,
	"creada_por" text,
	CONSTRAINT "tarifa_parametros_del_modelo" CHECK ((
        modelo = 'por_minuto'
        and tarifa_minima is not null and valor_minuto is not null
        and intervalo_minutos is null and valor_intervalo is null
      ) or (
        modelo = 'por_intervalo'
        and intervalo_minutos is not null and valor_intervalo is not null
        and tarifa_minima is null and valor_minuto is null
      )),
	CONSTRAINT "tarifa_importes_no_negativos" CHECK (tarifa_plena >= 0
        and coalesce(tarifa_minima, 0) >= 0
        and coalesce(valor_minuto, 0) >= 0
        and coalesce(valor_intervalo, 0) >= 0),
	CONSTRAINT "tarifa_intervalo_positivo" CHECK (intervalo_minutos is null or intervalo_minutos > 0),
	CONSTRAINT "tarifa_minima_no_supera_plena" CHECK (tarifa_minima is null or tarifa_minima <= tarifa_plena),
	CONSTRAINT "tarifa_vigencia_coherente" CHECK (vigente_hasta is null or vigente_hasta > vigente_desde)
);
--> statement-breakpoint
ALTER TABLE "tarifa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "horario_atencion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"abierto_24h" boolean NOT NULL,
	"cobra_horas_cerradas" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "horario_atencion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "horario_franja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"horario_id" uuid NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"hora_apertura" time NOT NULL,
	"hora_cierre" time NOT NULL,
	CONSTRAINT "franja_dia_valido" CHECK (dia_semana between 0 and 6),
	CONSTRAINT "franja_horas_distintas" CHECK (hora_apertura <> hora_cierre)
);
--> statement-breakpoint
ALTER TABLE "horario_franja" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capacidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"tipo_vehiculo_id" uuid NOT NULL,
	"cupos" integer NOT NULL,
	CONSTRAINT "capacidad_no_negativa" CHECK (cupos >= 0)
);
--> statement-breakpoint
ALTER TABLE "capacidad" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "turno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turno_horas_distintas" CHECK (hora_inicio <> hora_fin)
);
--> statement-breakpoint
ALTER TABLE "turno" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "turno_asignacion" (
	"turno_id" uuid NOT NULL,
	"usuario_id" text NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"desde" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turno_asignacion_turno_id_usuario_id_pk" PRIMARY KEY("turno_id","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "turno_asignacion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "turno_dia" (
	"turno_id" uuid NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	CONSTRAINT "turno_dia_turno_id_dia_semana_pk" PRIMARY KEY("turno_id","dia_semana"),
	CONSTRAINT "turno_dia_valido" CHECK (dia_semana between 0 and 6)
);
--> statement-breakpoint
ALTER TABLE "turno_dia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "convenio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descuento_pct" integer NOT NULL,
	"desde" timestamp with time zone DEFAULT now() NOT NULL,
	"hasta" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "convenio_descuento_valido" CHECK (descuento_pct between 0 and 100),
	CONSTRAINT "convenio_vigencia_coherente" CHECK (hasta is null or hasta > desde)
);
--> statement-breakpoint
ALTER TABLE "convenio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "convenio_placa" (
	"convenio_id" uuid NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"placa" text NOT NULL,
	CONSTRAINT "convenio_placa_convenio_id_placa_pk" PRIMARY KEY("convenio_id","placa")
);
--> statement-breakpoint
ALTER TABLE "convenio_placa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_tipo_vehiculo_id_tipo_vehiculo_id_fk" FOREIGN KEY ("tipo_vehiculo_id") REFERENCES "public"."tipo_vehiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_creada_por_user_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horario_atencion" ADD CONSTRAINT "horario_atencion_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horario_franja" ADD CONSTRAINT "horario_franja_horario_id_horario_atencion_id_fk" FOREIGN KEY ("horario_id") REFERENCES "public"."horario_atencion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horario_franja" ADD CONSTRAINT "horario_franja_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacidad" ADD CONSTRAINT "capacidad_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacidad" ADD CONSTRAINT "capacidad_tipo_vehiculo_id_tipo_vehiculo_id_fk" FOREIGN KEY ("tipo_vehiculo_id") REFERENCES "public"."tipo_vehiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno" ADD CONSTRAINT "turno_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_asignacion" ADD CONSTRAINT "turno_asignacion_turno_id_turno_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_asignacion" ADD CONSTRAINT "turno_asignacion_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_asignacion" ADD CONSTRAINT "turno_asignacion_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_dia" ADD CONSTRAINT "turno_dia_turno_id_turno_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turno"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turno_dia" ADD CONSTRAINT "turno_dia_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_placa" ADD CONSTRAINT "convenio_placa_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_placa" ADD CONSTRAINT "convenio_placa_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tarifa_una_vigente_por_tipo" ON "tarifa" USING btree ("parqueadero_id","tipo_vehiculo_id") WHERE vigente_hasta is null;--> statement-breakpoint
CREATE INDEX "tarifa_por_vigencia" ON "tarifa" USING btree ("parqueadero_id","tipo_vehiculo_id","vigente_desde");--> statement-breakpoint
CREATE UNIQUE INDEX "horario_uno_por_parqueadero" ON "horario_atencion" USING btree ("parqueadero_id");--> statement-breakpoint
CREATE UNIQUE INDEX "capacidad_una_por_tipo" ON "capacidad" USING btree ("parqueadero_id","tipo_vehiculo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "convenio_placa_unica_por_parqueadero" ON "convenio_placa" USING btree ("parqueadero_id","placa");--> statement-breakpoint
CREATE POLICY "tarifa_ambito" ON "tarifa" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "horario_ambito" ON "horario_atencion" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "horario_franja_ambito" ON "horario_franja" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "capacidad_ambito" ON "capacidad" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "turno_ambito" ON "turno" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "turno_asignacion_ambito" ON "turno_asignacion" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "turno_dia_ambito" ON "turno_dia" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "convenio_ambito" ON "convenio" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "convenio_placa_ambito" ON "convenio_placa" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);