CREATE TABLE "uso_privilegio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text,
	"operacion" text NOT NULL,
	"ocurrido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "uso_privilegio" ADD CONSTRAINT "uso_privilegio_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uso_privilegio_fecha" ON "uso_privilegio" USING btree ("ocurrido_en");