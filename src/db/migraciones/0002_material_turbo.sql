ALTER TABLE "user" ADD COLUMN "codigo" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_codigo_unique" UNIQUE("codigo");