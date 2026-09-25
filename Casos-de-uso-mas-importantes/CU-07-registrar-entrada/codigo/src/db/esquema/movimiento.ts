import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { tipoVehiculo } from "./tipo-vehiculo";
import { usuario } from "./usuario";
import { sesionTurno } from "./sesion-turno";
import { estadoComprobante } from "./enums";

/**
 * La estancia de un vehículo.
 *
 * Es el dato más sensible que ha existido en el sistema y el primero al que el
 * Principio IV tiene sujeto: hasta ahora no había movimientos que proteger.
 *
 * NO TIENE COLUMNA DE ESTADO, y es deliberado. Que el vehículo esté adentro se
 * deduce de que `salida_en` sea nulo. Una columna aparte podría contradecir a
 * las fechas, y entonces habría dos verdades sobre lo mismo y ninguna forma de
 * saber cuál vale.
 *
 * TAMPOCO SE PUEDE MODIFICAR una vez cerrado. Eso no se confía al código de la
 * aplicación: lo impide un disparador en `blindaje.sql`. El Principio IV no
 * acepta una garantía que dependa de que quien escriba la próxima consulta se
 * acuerde.
 */
export const movimiento = pgTable(
  "movimiento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    /**
     * Identificador legible con la sigla del establecimiento. Es lo que va en
     * el comprobante: alguien va a tener que leerlo por teléfono o escribirlo a
     * mano cuando el papel térmico se borre, y se borra.
     */
    codigo: text("codigo").notNull(),

    /**
     * Normalizada. Se compara siempre así, nunca como la escribió alguien.
     *
     * **Nula en las bicicletas**, que no tienen placa y se identifican por
     * ficha. El CHECK de abajo garantiza que haya exactamente una de las dos:
     * un movimiento se identifica de una sola manera, y permitir las dos
     * abriría la pregunta de cuál manda.
     */
    placa: text("placa"),

    /**
     * El número de ficha, en las bicicletas. Nulo cuando hay placa.
     *
     * La ficha ES el ticket: el mismo papel que sale para un carro, que en vez
     * de una placa lleva un número. No hay ningún tarjetón reutilizable que
     * devolver, así que tampoco hay inventario, ni estados, ni nada que perder.
     *
     * Cuántos números hay disponibles no se declara aparte: es la CAPACIDAD de
     * bicicletas que el establecimiento ya declaró. Un espacio es una ficha.
     *
     * La exclusividad —dos bicicletas no pueden llevar el mismo número a la
     * vez— la garantiza el índice único parcial de abajo, no este campo.
     */
    fichaNumero: integer("ficha_numero"),

    /**
     * Quién dejó la bicicleta. DATOS PERSONALES: se vacían al vencer el plazo
     * de retención, conservando el movimiento y su cobro.
     *
     * No es burocracia: una bicicleta no trae identificador propio, y si el
     * cliente pierde el ticket esto es lo único que permite devolvérsela.
     */
    nombre: text("nombre"),
    cedula: text("cedula"),
    telefono: text("telefono"),

    /**
     * Una seña de la bicicleta —"negra, marca Trek"—, opcional.
     *
     * Entra en la purga aunque parezca inocua: describe a una persona tanto
     * como su teléfono.
     */
    notaVehiculo: text("nota_vehiculo"),

    /** Derivado de la placa al entrar. Nunca lo elige una persona. */
    tipoVehiculoId: uuid("tipo_vehiculo_id")
      .notNull()
      .references(() => tipoVehiculo.id),

    entradaEn: timestamp("entrada_en", { withTimezone: true }).notNull().defaultNow(),
    /** Nulo ⇒ el vehículo está adentro. Es la única fuente del estado. */
    salidaEn: timestamp("salida_en", { withTimezone: true }),

    operarioEntrada: text("operario_entrada")
      .notNull()
      .references(() => usuario.id),
    operarioSalida: text("operario_salida").references(() => usuario.id),

    /**
     * En qué sesión de turno ocurrió cada extremo. Nulos si no había ninguna
     * abierta: no se deja un vehículo afuera porque nadie abrió su turno.
     *
     * Son dos y no uno porque la entrada y la salida pueden pertenecer a turnos
     * distintos, que es lo normal en un carro que se queda toda la tarde.
     */
    sesionEntrada: uuid("sesion_entrada").references(() => sesionTurno.id),
    sesionSalida: uuid("sesion_salida").references(() => sesionTurno.id),

    /** Lo cobrado, en pesos enteros. Nulo mientras el movimiento esté abierto. */
    importe: integer("importe"),

    /**
     * COPIA EMBEBIDA del desglose y de la tarifa que se usó, con los valores tal
     * como estaban al cobrar. No referencias.
     *
     * Es lo que exige el Principio IV, y la razón es práctica: los convenios no
     * se versionan —se decidió así precisamente porque esta copia iba a
     * existir—, así que un convenio editado mañana cambiaría la explicación de
     * un cobro de ayer. Un reporte de ingresos que cambia retroactivamente es un
     * reporte inservible.
     */
    cobro: jsonb("cobro"),

    /**
     * No nulo ⇒ salió sin cobrar. Es lo único que distingue una cortesía de un
     * cobro que dio cero, que son cosas distintas: una es dinero que se decidió
     * no cobrar y la otra es un cálculo.
     */
    cortesiaMotivo: text("cortesia_motivo"),
    cortesiaPor: text("cortesia_por").references(() => usuario.id),
    /** Cuánto se habría cobrado. Sin esto no se puede medir lo que cuestan. */
    cortesiaImporteOmitido: integer("cortesia_importe_omitido"),

    comprobante: estadoComprobante("comprobante").notNull().default("pendiente"),
  },
  (t) => [
    pgPolicy("movimiento_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),

    /**
     * Una placa, adentro una sola vez.
     *
     * Lo impone el MOTOR y no la aplicación, y ésa es la diferencia que importa:
     * dos operarios registrando la misma placa en el mismo instante chocan acá,
     * sin depender de que nadie haya consultado antes. Comprobar y después
     * insertar dejaría una rendija entre lo uno y lo otro.
     */
    uniqueIndex("movimiento_una_placa_adentro")
      .on(t.parqueaderoId, t.placa)
      .where(sql`salida_en is null`),

    /**
     * LA GARANTÍA de que dos operarios no entreguen la misma ficha.
     *
     * Misma técnica que `movimiento_una_placa_adentro` y por la misma razón:
     * dos recepciones simultáneas chocan acá, sin depender de que nadie haya
     * consultado antes. Comprobar y después insertar dejaría una rendija.
     */
    uniqueIndex("movimiento_una_ficha_afuera")
      .on(t.parqueaderoId, t.fichaNumero)
      .where(sql`salida_en is null`),

    /**
     * O placa o ficha, nunca las dos ni ninguna.
     *
     * Un movimiento se identifica de una sola manera. Permitir las dos abriría
     * la pregunta de cuál manda, y no tener ninguna dejaría un movimiento que
     * nadie puede reclamar.
     */
    check(
      "movimiento_un_identificador",
      sql`(placa is not null and ficha_numero is null)
       or (placa is null and ficha_numero is not null and ficha_numero >= 1)`,
    ),

    /** La búsqueda de quien perdió el tarjetón. */
    index("movimiento_por_cedula")
      .on(t.parqueaderoId, t.cedula)
      .where(sql`salida_en is null`),

    uniqueIndex("movimiento_codigo_unico").on(t.parqueaderoId, t.codigo),

    /** Lo que la taquilla consulta todo el tiempo: quiénes están adentro. */
    index("movimiento_adentro").on(t.parqueaderoId).where(sql`salida_en is null`),

    check("movimiento_salida_coherente", sql`salida_en is null or salida_en > entrada_en`),

    /**
     * Un movimiento cerrado sin saber cuánto se cobró no debería poder existir.
     * Con cortesía el importe es cero y el desglose puede faltar, porque no hubo
     * cobro que desglosar.
     */
    check(
      "movimiento_cerrado_completo",
      sql`salida_en is null
        or (cortesia_motivo is not null and importe = 0)
        or (importe is not null and cobro is not null)`,
    ),

    /** El motivo, el autor y el importe omitido van juntos o no van. */
    check(
      "movimiento_cortesia_completa",
      sql`(cortesia_motivo is null and cortesia_por is null and cortesia_importe_omitido is null)
        or (cortesia_motivo is not null and cortesia_por is not null
            and cortesia_importe_omitido is not null and salida_en is not null)`,
    ),

    check("movimiento_importe_no_negativo", sql`importe is null or importe >= 0`),
  ],
).enableRLS();

export type Movimiento = typeof movimiento.$inferSelect;
