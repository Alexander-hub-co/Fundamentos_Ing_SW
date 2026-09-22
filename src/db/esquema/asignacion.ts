import { sql } from "drizzle-orm";
import {
  check,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  text,
} from "drizzle-orm/pg-core";
import { rolUsuario } from "./enums";
import { parqueadero } from "./parqueadero";
import { usuario } from "./usuario";

/**
 * Vínculo entre una cuenta y el establecimiento sobre el que opera, con el rol
 * que ejerce allí. Es lo que determina el ámbito de cada sesión.
 */
export const asignacion = pgTable(
  "asignacion",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),

    /** NULL sólo para el rol global. Ver la restricción de abajo. */
    parqueaderoId: uuid("parqueadero_id").references(() => parqueadero.id),

    rol: rolUsuario("rol").notNull(),

    creadaEn: timestamp("creada_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /**
     * Una cuenta, un establecimiento (FR-020). Es la traducción literal de la
     * decisión de clarificación. Cuando se habilite multi-sede, este único se
     * reemplaza por uno parcial y se añade el selector de sede activa: la tabla
     * no cambia de forma.
     */
    unique("asignacion_usuario_unico").on(t.usuarioId),

    /**
     * El rol global no pertenece a ningún establecimiento; los otros dos
     * siempre pertenecen a uno. Hace estructuralmente imposible un usuario de
     * establecimiento sin ámbito, que es el caso que el escenario 3 de la
     * historia 2 exige denegar.
     */
    check(
      "asignacion_ambito_coherente",
      sql`(rol = 'admin_general' AND parqueadero_id IS NULL)
          OR (rol <> 'admin_general' AND parqueadero_id IS NOT NULL)`,
    ),

    /**
     * Las asignaciones globales quedan fuera de toda consulta con ámbito, que
     * es lo correcto: sólo son visibles por la conexión privilegiada.
     */
    pgPolicy("asignacion_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
  ],
).enableRLS();

export type Asignacion = typeof asignacion.$inferSelect;
