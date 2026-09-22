import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { usuario } from "./usuario";

const politicaAmbito = (nombre: string) =>
  pgPolicy(nombre, {
    as: "permissive",
    for: "all",
    using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
  });

/**
 * Franja de trabajo del establecimiento.
 *
 * Las horas se guardan como hora del reloj y no como instantes porque un turno
 * es una regla que se repite, no un suceso. Que `horaFin < horaInicio` es
 * precisamente lo que indica que cruza la medianoche, y esa lectura ocurre en
 * un solo lugar: al expandir el turno sobre el calendario.
 *
 * Se desactiva, nunca se borra: los movimientos que F3 registre bajo un turno
 * tienen que seguir siendo explicables después (Principio IV).
 */
export const turno = pgTable(
  "turno",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    /** Libre: "Mañana", "Turno 1", "Nocturno". Cada local nombra como nombra. */
    nombre: text("nombre").notNull(),

    horaInicio: time("hora_inicio").notNull(),
    horaFin: time("hora_fin").notNull(),

    activo: boolean("activo").notNull().default(true),

    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    politicaAmbito("turno_ambito"),
    /** Horas iguales no expresan duración; un turno de 24 h se declara así. */
    check("turno_horas_distintas", sql`hora_inicio <> hora_fin`),
  ],
).enableRLS();

/**
 * Los días en que rige un turno, una fila por día.
 *
 * En filas y no en máscara de bits ni en arreglo: se consulta, se indexa y se
 * lee en un volcado de la base sin decodificar nada.
 */
export const turnoDia = pgTable(
  "turno_dia",
  {
    turnoId: uuid("turno_id")
      .notNull()
      .references(() => turno.id, { onDelete: "cascade" }),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    /** 0 = domingo, 6 = sábado. */
    diaSemana: integer("dia_semana").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.turnoId, t.diaSemana] }),
    politicaAmbito("turno_dia_ambito"),
    check("turno_dia_valido", sql`dia_semana between 0 and 6`),
  ],
).enableRLS();

/**
 * Quién cubre un turno.
 *
 * Muchos a muchos: una persona puede estar en varios turnos y un turno puede
 * tener varias personas. Como columna en `turno` obligaría a duplicar el turno
 * por persona, y entonces cambiar su horario dejaría de ser atómico.
 *
 * Que la persona pertenezca al establecimiento se verifica en el dominio y no
 * con una clave foránea: esa relación vive en `asignacion`, y una foránea
 * compuesta obligaría a duplicar acá el rol.
 */
export const turnoAsignacion = pgTable(
  "turno_asignacion",
  {
    turnoId: uuid("turno_id")
      .notNull()
      .references(() => turno.id, { onDelete: "cascade" }),

    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuario.id),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    desde: timestamp("desde", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.turnoId, t.usuarioId] }),
    politicaAmbito("turno_asignacion_ambito"),
  ],
).enableRLS();

export type Turno = typeof turno.$inferSelect;
export type TurnoDia = typeof turnoDia.$inferSelect;
export type TurnoAsignacion = typeof turnoAsignacion.$inferSelect;
