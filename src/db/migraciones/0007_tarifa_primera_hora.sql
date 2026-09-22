-- Columna y restricciones del tercer modelo de cobro.
-- Va aparte de la migración anterior por la regla de los enums de PostgreSQL.
ALTER TABLE "tarifa" DROP CONSTRAINT "tarifa_parametros_del_modelo";--> statement-breakpoint
ALTER TABLE "tarifa" DROP CONSTRAINT "tarifa_importes_no_negativos";--> statement-breakpoint
ALTER TABLE "tarifa" ADD COLUMN "valor_primera_hora" integer;--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_parametros_del_modelo" CHECK ((
        modelo = 'por_minuto'
        and tarifa_minima is not null and valor_minuto is not null
        and intervalo_minutos is null and valor_intervalo is null
        and valor_primera_hora is null
      ) or (
        modelo = 'por_intervalo'
        and intervalo_minutos is not null and valor_intervalo is not null
        and tarifa_minima is null and valor_minuto is null
        and valor_primera_hora is null
      ) or (
        modelo = 'primera_hora_y_fraccion'
        and valor_primera_hora is not null
        and intervalo_minutos is not null and valor_intervalo is not null
        and tarifa_minima is null and valor_minuto is null
      ));--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_importes_no_negativos" CHECK (tarifa_plena >= 0
        and coalesce(tarifa_minima, 0) >= 0
        and coalesce(valor_minuto, 0) >= 0
        and coalesce(valor_intervalo, 0) >= 0
        and coalesce(valor_primera_hora, 0) >= 0);
