import { sql } from "drizzle-orm";
import { check, integer, pgPolicy, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { tipoVehiculo } from "./tipo-vehiculo";

/**
 * Cupos declarados por tipo de vehículo.
 *
 * Es un dato de configuración: cuántos caben. Contar cuántos están ocupados
 * pertenece a F3 y necesita movimientos, que todavía no existen.
 */
export const capacidad = pgTable(
  "capacidad",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    tipoVehiculoId: uuid("tipo_vehiculo_id")
      .notNull()
      .references(() => tipoVehiculo.id),

    cupos: integer("cupos").notNull(),
  },
  (t) => [
    pgPolicy("capacidad_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
    uniqueIndex("capacidad_una_por_tipo").on(t.parqueaderoId, t.tipoVehiculoId),
    check("capacidad_no_negativa", sql`cupos >= 0`),
  ],
).enableRLS();

export type Capacidad = typeof capacidad.$inferSelect;
