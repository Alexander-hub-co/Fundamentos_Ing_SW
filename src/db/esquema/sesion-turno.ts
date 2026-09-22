import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { turno } from "./turno";
import { usuario } from "./usuario";

/**
 * Una jornada concreta de un turno declarado.
 *
 * Guarda la hora REAL además de la programada, y ésa es toda su razón de ser:
 * casi nunca coinciden, y la diferencia es justamente lo que hay que poder
 * revisar cuando no cuadra una caja.
 */
export const sesionTurno = pgTable(
  "sesion_turno",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    turnoId: uuid("turno_id")
      .notNull()
      .references(() => turno.id),

    abiertaPor: text("abierta_por")
      .notNull()
      .references(() => usuario.id),

    abiertaEn: timestamp("abierta_en", { withTimezone: true }).notNull().defaultNow(),
    cerradaEn: timestamp("cerrada_en", { withTimezone: true }),

    /**
     * Copiadas del turno al abrir, no leídas de él después. Si mañana se cambia
     * el horario del turno, esta sesión debe seguir diciendo a qué hora se
     * suponía que empezaba cuando ocurrió.
     */
    programadaInicio: time("programada_inicio").notNull(),
    programadaFin: time("programada_fin").notNull(),
  },
  (t) => [
    pgPolicy("sesion_turno_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),

    /** Una persona no puede estar en dos turnos a la vez. */
    uniqueIndex("sesion_una_abierta_por_persona")
      .on(t.parqueaderoId, t.abiertaPor)
      .where(sql`cerrada_en is null`),
  ],
).enableRLS();

export type SesionTurno = typeof sesionTurno.$inferSelect;
