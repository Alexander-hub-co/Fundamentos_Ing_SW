import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { modeloCobro } from "./enums";

/**
 * Catálogo de tipos de vehículo.
 *
 * SIN `parqueadero_id` Y SIN RLS, y es deliberado. Es la segunda excepción
 * legítima al Principio I, junto a las tablas de autenticación, y por las
 * mismas razones estructurales: es catálogo compartido de la plataforma, no
 * dato operativo de nadie.
 *
 * Si cada establecimiento nombrara sus propios tipos, dos reportes dejarían de
 * ser comparables: "automóvil" en un local y "carro" en otro serían cosas
 * distintas para el sistema. Un establecimiento elige a cuáles les pone tarifa;
 * no elige cómo se llaman.
 *
 * La guardia de `blindaje.sql` no la marcará, porque busca tablas CON columna
 * de ámbito y sin política. Esta no tiene ámbito que proteger.
 */
export const tipoVehiculo = pgTable("tipo_vehiculo", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Estable y legible: es lo que referencia el código, no el nombre. */
  codigo: text("codigo").notNull().unique(),

  nombre: text("nombre").notNull(),

  /**
   * El modelo que le corresponde normalmente. Es una sugerencia para la
   * pantalla, no una imposición: un establecimiento podría cobrar sus
   * bicicletas por minuto si quisiera.
   */
  modeloSugerido: modeloCobro("modelo_sugerido").notNull(),

  /** Para que los listados salgan siempre en el mismo orden. */
  orden: integer("orden").notNull().default(0),
});

export type TipoVehiculo = typeof tipoVehiculo.$inferSelect;
