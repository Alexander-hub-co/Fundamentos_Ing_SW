CREATE TABLE "mantenimiento" (
	"clave" text PRIMARY KEY NOT NULL,
	"ejecutado_en" timestamp with time zone DEFAULT now() NOT NULL
);
