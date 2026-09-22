CREATE TYPE "public"."estado_parqueadero" AS ENUM('activo', 'pendiente', 'suspendido', 'dado_de_baja');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin_general', 'admin_parqueadero', 'operario');--> statement-breakpoint
CREATE TABLE "parqueadero" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"ciudad" text,
	"telefono" text,
	"estado" "estado_parqueadero" DEFAULT 'activo' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parqueadero_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "parqueadero" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"debe_cambiar_password" boolean DEFAULT true NOT NULL,
	"anonimizada_en" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asignacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"parqueadero_id" uuid,
	"rol" "rol_usuario" NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asignacion_usuario_unico" UNIQUE("usuario_id"),
	CONSTRAINT "asignacion_ambito_coherente" CHECK ((rol = 'admin_general' AND parqueadero_id IS NULL)
          OR (rol <> 'admin_general' AND parqueadero_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "asignacion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acceso_denegado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text,
	"recurso" text NOT NULL,
	"parqueadero_ambito" uuid,
	"ocurrido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cambio_estado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parqueadero_id" uuid NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text NOT NULL,
	"motivo" text NOT NULL,
	"ejecutado_por" text,
	"ocurrido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intento_login" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_intentado" text NOT NULL,
	"usuario_id" text,
	"origen" text,
	"exito" boolean NOT NULL,
	"ocurrido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_parqueadero_id_parqueadero_id_fk" FOREIGN KEY ("parqueadero_id") REFERENCES "public"."parqueadero"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceso_denegado" ADD CONSTRAINT "acceso_denegado_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cambio_estado" ADD CONSTRAINT "cambio_estado_ejecutado_por_user_id_fk" FOREIGN KEY ("ejecutado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intento_login" ADD CONSTRAINT "intento_login_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acceso_denegado_fecha" ON "acceso_denegado" USING btree ("ocurrido_en");--> statement-breakpoint
CREATE INDEX "cambio_estado_parqueadero" ON "cambio_estado" USING btree ("parqueadero_id","ocurrido_en");--> statement-breakpoint
CREATE INDEX "intento_login_email_fecha" ON "intento_login" USING btree ("email_intentado","ocurrido_en");--> statement-breakpoint
CREATE POLICY "parqueadero_ambito" ON "parqueadero" AS PERMISSIVE FOR ALL TO public USING (id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "asignacion_ambito" ON "asignacion" AS PERMISSIVE FOR ALL TO public USING (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid) WITH CHECK (parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid);