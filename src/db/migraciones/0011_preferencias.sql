-- Preferencias visuales por cuenta (pantalla 8d, "Ajustes").
--
-- Escrita a mano: drizzle-kit exige un terminal interactivo para resolver
-- ciertas ambigüedades y acá no lo hay.
--
-- Tabla de PLATAFORMA, sin política RLS y a propósito: la preferencia es de la
-- persona, no del parqueadero. Un operario que atiende dos establecimientos no
-- quiere que el tema le cambie al pasar de uno al otro. Cada lectura se acota
-- a la propia cuenta en el dominio, igual que ya se hace con el nombre.

CREATE TYPE "public"."tema_visual" AS ENUM('claro', 'oscuro');--> statement-breakpoint
CREATE TYPE "public"."acento_visual" AS ENUM('verde', 'azul', 'marino');--> statement-breakpoint
CREATE TYPE "public"."densidad_taquilla" AS ENUM('densa', 'comoda');--> statement-breakpoint

CREATE TABLE "preferencia_usuario" (
	"usuario_id" text PRIMARY KEY NOT NULL,
	"tema" "tema_visual" NOT NULL,
	"acento" "acento_visual" NOT NULL,
	"densidad" "densidad_taquilla" NOT NULL,
	"tamano_placa" integer NOT NULL,
	"confirmar_cobro" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preferencia_placa_legible" CHECK ("tamano_placa" between 40 and 96)
);--> statement-breakpoint

ALTER TABLE "preferencia_usuario"
  ADD CONSTRAINT "preferencia_usuario_usuario_id_user_id_fk"
  FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
