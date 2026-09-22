import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { alcancePlena, modeloCobro } from "./enums";
import { parqueadero } from "./parqueadero";
import { tipoVehiculo } from "./tipo-vehiculo";
import { usuario } from "./usuario";

/**
 * Tarifa de un tipo de vehículo en un establecimiento, versionada por rango.
 *
 * NO SE ACTUALIZA NUNCA. Cambiar una tarifa cierra la versión vigente —le pone
 * `vigenteHasta`— e inserta una nueva. Es lo que permite cobrar mañana un
 * vehículo que entró hoy con la tarifa que regía al entrar, y lo que hace que
 * un cobro de hace seis meses siga siendo explicable (Principio IV).
 *
 * Se eligió rango temporal y no número de versión porque la pregunta que la
 * taquilla va a hacer es "qué tarifa regía a las 14:32 del martes", y un
 * contador no la responde sin recorrer el historial.
 *
 * Las columnas de ambos modelos conviven en la misma tabla y el CHECK por
 * modelo exige exactamente las suyas. La alternativa —una columna JSON— dejaría
 * pasar una tarifa incompleta en silencio, y reventaría meses después en la
 * taquilla, con fila esperando.
 */
export const tarifa = pgTable(
  "tarifa",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    tipoVehiculoId: uuid("tipo_vehiculo_id")
      .notNull()
      .references(() => tipoVehiculo.id),

    modelo: modeloCobro("modelo").notNull(),

    // --- Modelo por minuto. Nulos en el otro modelo. ---
    /** Piso del cobro: lo que se paga aunque el cálculo dé menos. */
    tarifaMinima: integer("tarifa_minima"),
    valorMinuto: integer("valor_minuto"),

    // --- Por intervalo y primera hora comparten el bloque. ---
    intervaloMinutos: integer("intervalo_minutos"),
    valorIntervalo: integer("valor_intervalo"),

    // --- Sólo primera_hora_y_fraccion. ---
    /** Precio fijo de la primera hora, antes de empezar a cobrar bloques. */
    valorPrimeraHora: integer("valor_primera_hora"),

    // --- Común a ambos ---
    /** Techo del cobro. Qué tramo topa lo decide `alcancePlena`. */
    tarifaPlena: integer("tarifa_plena").notNull(),
    alcancePlena: alcancePlena("alcance_plena").notNull(),

    vigenteDesde: timestamp("vigente_desde", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Nulo ⇒ es la versión en curso. */
    vigenteHasta: timestamp("vigente_hasta", { withTimezone: true }),

    creadaPor: text("creada_por").references(() => usuario.id),
  },
  (t) => [
    pgPolicy("tarifa_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),

    /**
     * El único error que este diseño puede cometer: dos versiones abiertas del
     * mismo par. Con esto, el segundo intento de dejar una tarifa vigente sin
     * cerrar la anterior falla en la base y no produce una ambigüedad silenciosa
     * sobre cuál cobra.
     */
    uniqueIndex("tarifa_una_vigente_por_tipo")
      .on(t.parqueaderoId, t.tipoVehiculoId)
      .where(sql`vigente_hasta is null`),

    /** Para "qué regía en tal momento", que es la consulta de la taquilla. */
    index("tarifa_por_vigencia").on(t.parqueaderoId, t.tipoVehiculoId, t.vigenteDesde),

    /**
     * Cada modelo exige sus columnas y anula las del otro. Sin esto, una tarifa
     * por intervalos con un valor por minuto suelto sería un estado que el
     * calculador no sabe interpretar.
     */
    check(
      "tarifa_parametros_del_modelo",
      sql`(
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
      )`,
    ),

    check(
      "tarifa_importes_no_negativos",
      sql`tarifa_plena >= 0
        and coalesce(tarifa_minima, 0) >= 0
        and coalesce(valor_minuto, 0) >= 0
        and coalesce(valor_intervalo, 0) >= 0
        and coalesce(valor_primera_hora, 0) >= 0`,
    ),

    /** Un intervalo de cero minutos haría infinita la división. */
    check("tarifa_intervalo_positivo", sql`intervalo_minutos is null or intervalo_minutos > 0`),

    /** Si la mínima superara a la plena, ninguna estadía sería cobrable. */
    check(
      "tarifa_minima_no_supera_plena",
      sql`tarifa_minima is null or tarifa_minima <= tarifa_plena`,
    ),

    check(
      "tarifa_vigencia_coherente",
      sql`vigente_hasta is null or vigente_hasta > vigente_desde`,
    ),
  ],
).enableRLS();

export type Tarifa = typeof tarifa.$inferSelect;
export type TarifaNueva = typeof tarifa.$inferInsert;
