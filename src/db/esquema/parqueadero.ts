import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { estadoParqueadero } from "./enums";

/**
 * Raíz de tenencia de la plataforma. Todo dato operativo del producto cuelga de
 * esta tabla, y su identificador es lo que la variable de sesión
 * `app.parqueadero_id` transporta dentro de cada transacción.
 */
export const parqueadero = pgTable(
  "parqueadero",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Código interno generado por la plataforma. Único e inmutable (FR-015).
     * La inmutabilidad la impone un disparador, no la aplicación: FR-015 dice
     * "durante toda la vida del establecimiento" y eso debe sobrevivir a
     * cualquier código futuro.
     *
     * Deliberadamente NO se ancla a ningún identificador externo como el NIT.
     * La contrapartida, aceptada en clarificación (FR-016), es que el sistema
     * no puede detectar por sí mismo un alta duplicada del mismo negocio real.
     */
    codigo: text("codigo").notNull().unique(),

    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    ciudad: text("ciudad"),
    telefono: text("telefono"),

    estado: estadoParqueadero("estado").notNull().default("activo"),

    creadoEn: timestamp("creado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    /**
     * El corazón del Principio I. Sin ámbito fijado, `current_setting` devuelve
     * cadena vacía y la comparación no encuentra nada: la consulta devuelve
     * cero filas en lugar del conjunto completo (FR-010).
     */
    pgPolicy("parqueadero_ambito", {
      as: "permissive",
      for: "all",
      using: sql`id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
  ],
).enableRLS();

export type Parqueadero = typeof parqueadero.$inferSelect;
export type ParqueaderoNuevo = typeof parqueadero.$inferInsert;
