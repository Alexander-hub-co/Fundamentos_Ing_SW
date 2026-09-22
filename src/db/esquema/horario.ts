import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgPolicy,
  pgTable,
  time,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";

/**
 * Horario de atención del establecimiento.
 *
 * Dejó de ser un dato informativo cuando apareció la jornada tarifaria: el
 * cobro de las tarifas con plena por jornada se apoya en él, y si el
 * establecimiento no cobra las horas cerradas, esas horas desaparecen del
 * cálculo. Un horario mal declarado ya no produce un cartel equivocado sino un
 * cobro equivocado.
 */
export const horarioAtencion = pgTable(
  "horario_atencion",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    /** Si es cierto, las franjas se ignoran y la jornada corta a medianoche. */
    abierto24h: boolean("abierto_24h").notNull(),

    /**
     * Si el establecimiento cobra las horas en que estuvo cerrado a quien se
     * quedó adentro. Se declara siempre: no hay valor por defecto invisible.
     */
    cobraHorasCerradas: boolean("cobra_horas_cerradas").notNull(),
  },
  (t) => [
    pgPolicy("horario_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
    uniqueIndex("horario_uno_por_parqueadero").on(t.parqueaderoId),
  ],
).enableRLS();

/**
 * Una franja de atención de un día de la semana.
 *
 * `parqueaderoId` está denormalizado a propósito: la política RLS necesita el
 * ámbito en la propia fila. Con una subconsulta a la tabla padre, cada lectura
 * pagaría el rodeo y la política sería más fácil de escribir mal.
 *
 * Un día sin ninguna franja es un día cerrado. No hace falta una bandera: la
 * ausencia ya lo dice, y una bandera podría contradecir a las franjas.
 */
export const horarioFranja = pgTable(
  "horario_franja",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    horarioId: uuid("horario_id")
      .notNull()
      .references(() => horarioAtencion.id, { onDelete: "cascade" }),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    /** 0 = domingo, 6 = sábado. */
    diaSemana: integer("dia_semana").notNull(),

    horaApertura: time("hora_apertura").notNull(),
    /** Menor que la apertura ⇒ la franja cruza la medianoche. */
    horaCierre: time("hora_cierre").notNull(),
  },
  () => [
    pgPolicy("horario_franja_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
    check("franja_dia_valido", sql`dia_semana between 0 and 6`),
    /** Horas iguales no expresan duración; 24 horas se declara con la bandera. */
    check("franja_horas_distintas", sql`hora_apertura <> hora_cierre`),
  ],
).enableRLS();

export type HorarioAtencion = typeof horarioAtencion.$inferSelect;
export type HorarioFranja = typeof horarioFranja.$inferSelect;
