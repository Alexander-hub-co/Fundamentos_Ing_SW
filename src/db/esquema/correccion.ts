import { sql } from "drizzle-orm";
import { check, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { movimiento } from "./movimiento";
import { usuario } from "./usuario";

/**
 * Un asiento que corrige un cobro. NUNCA modifica el movimiento original.
 *
 * Conserva los dos números por construcción: lo cobrado sigue en el movimiento
 * y lo que se debió cobrar vive acá. Reemplazar uno por otro destruiría la
 * única prueba de que hubo un error y de cuánto fue.
 */
export const correccion = pgTable(
  "correccion",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    movimientoId: uuid("movimiento_id")
      .notNull()
      .references(() => movimiento.id),

    /** Lo que se debió cobrar. Lo cobrado está en el movimiento. */
    importeCorregido: integer("importe_corregido").notNull(),

    /** Obligatorio. Es lo único que después distingue un arreglo de un desvío. */
    motivo: text("motivo").notNull(),

    emitidaPor: text("emitida_por")
      .notNull()
      .references(() => usuario.id),
    emitidaEn: timestamp("emitida_en", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("correccion_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),

    check("correccion_importe_no_negativo", sql`importe_corregido >= 0`),
    check("correccion_motivo_no_vacio", sql`length(trim(motivo)) > 0`),
  ],
).enableRLS();

export type Correccion = typeof correccion.$inferSelect;
