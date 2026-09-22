import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { activacionConvenio, beneficioConvenio, periodicidadConvenio } from "./enums";
import { usuario } from "./usuario";

const politicaAmbito = (nombre: string) =>
  pgPolicy(nombre, {
    as: "permissive",
    for: "all",
    using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
  });

/**
 * Acuerdo de un establecimiento con un comercio vecino o con unas placas.
 *
 * Se describe con dos ejes en vez de un campo: CUÁNDO aplica —por sello o por
 * placa— y QUÉ hace —minutos gratis, porcentaje, tarifa fija o sin cobro—. Con
 * eso se expresan los acuerdos que existen de verdad en Colombia: el fruver que
 * sella el ticket a cambio de una hora, la carnicería que da media, el cliente
 * frecuente al que se le cobra la mitad y la mensualidad a la que no se le
 * cobra la salida. Un formulario de campos fijos no cubría esa variedad y un
 * texto libre no se puede calcular.
 */
export const convenio = pgTable(
  "convenio",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    nombre: text("nombre").notNull(),

    activacion: activacionConvenio("activacion").notNull(),

    /**
     * Si este convenio alcanza también a las bicicletas.
     *
     * FALSO por defecto, y es la decisión correcta: un convenio se declaró
     * pensando en los carros del comercio de al lado, y extenderlo a las
     * bicicletas sin que nadie lo pidiera regalaría dinero en silencio. Que el
     * administrador tenga que encenderlo es lo que convierte eso en una
     * decisión suya.
     *
     * Va por convenio y no por establecimiento porque los acuerdos son
     * distintos entre sí: el del supermercado puede cubrir bicicletas y el del
     * edificio de oficinas no.
     */
    aplicaBicicletas: boolean("aplica_bicicletas").notNull().default(false),
    beneficio: beneficioConvenio("beneficio").notNull(),

    /**
     * Minutos, porcentaje o pesos, según el beneficio. Nulo sólo para
     * `sin_cobro`, que no necesita ninguno. El CHECK de abajo garantiza que la
     * combinación sea coherente.
     */
    valor: integer("valor"),

    /** Cuánto puede descontar este convenio como máximo. Nulo ⇒ sin tope. */
    topePesos: integer("tope_pesos"),

    /**
     * Cuántas veces al día puede aplicarse a una misma placa. Nulo ⇒ sin
     * límite. El formulario obliga a elegirlo explícitamente: un campo en
     * blanco no distingue "quiero que sea ilimitado" de "se me olvidó".
     */
    limiteDiario: integer("limite_diario"),

    /**
     * Quién lo declaró. Sirve para distinguir un cambio hecho por soporte:
     * un identificador que no pertenece al establecimiento ES la marca, sin
     * necesidad de una columna aparte que diga "esto lo hizo la plataforma".
     */
    creadoPor: text("creado_por").references(() => usuario.id),

    desde: timestamp("desde", { withTimezone: true }).notNull().defaultNow(),
    /** Nulo ⇒ sin vencimiento. */
    hasta: timestamp("hasta", { withTimezone: true }),

    /**
     * La duración con la que se declaró, cuando se declaró por duración y no
     * por fecha. Se guarda ADEMÁS de la fecha que produce, no en su lugar: sin
     * esto la lista diría "vence el 19 de septiembre" en vez de "mensualidad",
     * que es lo que quien administra reconoce de un vistazo.
     */
    periodicidad: periodicidadConvenio("periodicidad"),

    activo: boolean("activo").notNull().default(true),
  },
  () => [
    politicaAmbito("convenio_ambito"),

    /**
     * Cada beneficio exige lo suyo y prohíbe lo ajeno. Mismo patrón que
     * `tarifa_parametros_del_modelo`: la validación vive en el motor, así que
     * no existe forma de escribir un convenio incoherente ni desde la
     * aplicación ni desde una consulta a mano.
     */
    check(
      "convenio_parametros_del_beneficio",
      sql`(
        beneficio = 'minutos_gratis' and valor is not null and valor > 0
      ) or (
        beneficio = 'porcentaje' and valor is not null and valor between 1 and 100
      ) or (
        beneficio = 'tarifa_fija' and valor is not null and valor >= 0
      ) or (
        beneficio = 'sin_cobro' and valor is null
      )`,
    ),

    check("convenio_tope_valido", sql`tope_pesos is null or tope_pesos > 0`),

    /**
     * El cero se rechaza acá, en el motor, y no sólo en el formulario. Un
     * convenio que no puede aplicarse nunca no es uno limitado sino uno
     * desactivado, y para eso ya está la columna `activo`.
     */
    check("convenio_limite_valido", sql`limite_diario is null or limite_diario >= 1`),

    check("convenio_vigencia_coherente", sql`hasta is null or hasta > desde`),

    /** Una mensualidad que no vence no es una mensualidad (FR-005c). */
    check(
      "convenio_periodicidad_vence",
      sql`periodicidad is null or hasta is not null`,
    ),
  ],
).enableRLS();

/**
 * Placa cubierta por un convenio.
 *
 * La placa se guarda normalizada —mayúsculas, sin espacios ni guiones— para que
 * "abc 123" y "ABC-123" no sean dos clientes distintos.
 */
export const convenioPlaca = pgTable(
  "convenio_placa",
  {
    convenioId: uuid("convenio_id")
      .notNull()
      .references(() => convenio.id, { onDelete: "cascade" }),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .references(() => parqueadero.id),

    placa: text("placa").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.convenioId, t.placa] }),
    politicaAmbito("convenio_placa_ambito"),

    /**
     * Una placa, un convenio por establecimiento. Es lo que hace determinista
     * la resolución del descuento: sin esto, dos convenios podrían cubrir la
     * misma placa y cuál gana dependería del orden de registro.
     */
    uniqueIndex("convenio_placa_unica_por_parqueadero").on(t.parqueaderoId, t.placa),
  ],
).enableRLS();

export type Convenio = typeof convenio.$inferSelect;
export type ConvenioPlaca = typeof convenioPlaca.$inferSelect;
