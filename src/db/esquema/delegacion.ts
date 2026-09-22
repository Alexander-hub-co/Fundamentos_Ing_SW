import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { usuario } from "./usuario";
import { operacionDelegable } from "./enums";

/**
 * Una operación que un administrador autorizó a una persona concreta.
 *
 * La constitución 1.1.0 la admite y la acota con cuatro reglas, y las cuatro se
 * cumplen por la forma de esta tabla:
 *
 *   1. La operación viene de una enumeración, que es la lista cerrada. Hoy tiene
 *      un solo valor. Ampliarla exige volver a la especificación, no añadir una
 *      fila.
 *   2. Quién otorgó, a quién y cuándo son columnas, no un comentario.
 *   3. Se revoca marcando, no borrando: revocar es un hecho que también se
 *      audita, y las correcciones ya emitidas siguen siendo válidas porque lo
 *      eran cuando se hicieron.
 *   4. El ámbito lo impone la misma política que protege todo lo demás, así que
 *      una delegación no puede alcanzar fuera del establecimiento de quien la
 *      otorga.
 *
 * NO crea un rol nuevo. La cuenta sigue teniendo el suyo.
 */
export const delegacion = pgTable(
  "delegacion",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),

    operacion: operacionDelegable("operacion").notNull(),

    otorgadaPor: text("otorgada_por")
      .notNull()
      .references(() => usuario.id),
    otorgadaEn: timestamp("otorgada_en", { withTimezone: true }).notNull().defaultNow(),

    /** Nulo ⇒ vigente. */
    revocadaEn: timestamp("revocada_en", { withTimezone: true }),
  },
  (t) => [
    pgPolicy("delegacion_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),

    /** Una sola delegación vigente por persona y operación. */
    uniqueIndex("delegacion_una_vigente")
      .on(t.parqueaderoId, t.usuarioId, t.operacion)
      .where(sql`revocada_en is null`),
  ],
).enableRLS();

export type Delegacion = typeof delegacion.$inferSelect;
