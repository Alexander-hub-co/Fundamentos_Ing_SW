import type {
  ActivacionConvenio,
  BeneficioConvenio,
  ReglaRedondeo,
} from "@/db/esquema";
import type { AlcancePlena, ModeloCobro } from "@/db/esquema/enums";

/**
 * Los dos modelos de cobro, como tipos.
 *
 * Unión discriminada por `modelo`: TypeScript obliga a distinguirlos antes de
 * leer los parámetros, así que no hay forma de consultar el valor por minuto de
 * una tarifa por intervalos. La misma invariante la sostiene el CHECK de la
 * tabla, para que tampoco entre por la base.
 *
 * Este archivo NO importa nada de acceso a datos, a propósito: el calculador
 * debe poder ejercitarse sin base.
 */

/** Parámetros comunes a los dos modelos. */
type Comun = {
  /** Techo del cobro. Qué tramo topa lo decide `alcancePlena`. */
  tarifaPlena: number;
  alcancePlena: AlcancePlena;
};

/**
 * Cobro por minuto, para vehículos motorizados.
 *
 * El valor crece minuto a minuto y queda acotado por abajo con la mínima y por
 * arriba con la plena.
 */
export type TarifaPorMinuto = Comun & {
  modelo: "por_minuto";
  /** Piso: lo que se paga aunque el cálculo dé menos. */
  tarifaMinima: number;
  valorMinuto: number;
};

/**
 * Cobro por intervalos, para bicicletas.
 *
 * Cualquier fracción de intervalo cobra el intervalo entero: con intervalos de
 * 30 minutos, 31 minutos cobran dos.
 */
export type TarifaPorIntervalo = Comun & {
  modelo: "por_intervalo";
  intervaloMinutos: number;
  valorIntervalo: number;
};

/**
 * Primera hora a precio fijo y después bloques.
 *
 * La primera hora se cobra entera aunque el vehículo se vaya a los diez
 * minutos; a partir de ahí, cada fracción de bloque cobra el bloque completo,
 * igual que en el modelo por intervalos.
 */
export type TarifaPrimeraHoraYFraccion = Comun & {
  modelo: "primera_hora_y_fraccion";
  valorPrimeraHora: number;
  intervaloMinutos: number;
  valorIntervalo: number;
};

export type TarifaAplicable =
  | TarifaPorMinuto
  | TarifaPorIntervalo
  | TarifaPrimeraHoraYFraccion;

/** Minutos de la primera hora. No es configurable: una hora es una hora. */
export const MINUTOS_PRIMERA_HORA = 60;

/** Qué tope acabó determinando el importe. */
export type TopeAplicado = "ninguno" | "minima" | "plena";

/** Lo que se cobró en un tramo, y por qué. */
export type TramoCobrado = {
  desde: Date;
  hasta: Date;
  minutos: number;
  /** Sólo en el modelo por intervalos. */
  intervalos?: number;
  importe: number;
  tope: TopeAplicado;
};

/**
 * Resultado del cálculo.
 *
 * No es un número: trae el desglose que lo justifica. La especificación exige
 * que el operario pueda explicarle al cliente por qué paga esa cifra, y un
 * desglose reconstruido después en la interfaz se desincroniza del cálculo real
 * tarde o temprano.
 */
export type Cobro = {
  importe: number;
  minutosTotales: number;
  tramos: TramoCobrado[];
  /** El tope que determinó el total, mirando el cobro completo. */
  tope: TopeAplicado;
};

export type { ModeloCobro, AlcancePlena };

/**
 * Un convenio, tal como lo necesita el cálculo.
 *
 * Deliberadamente NO es la fila de la tabla: lleva sólo lo que participa en el
 * cálculo, más el nombre, que hace falta para el desglose.
 *
 * `aplicacionesPreviasHoy` LO APORTA QUIEN LLAMA y no lo averigua el
 * calculador. Ésa es la decisión que permite entregar y probar la regla del
 * límite diario hoy, sin que exista historial de movimientos: el comprobador lo
 * escribe a mano y mañana la taquilla lo saca del historial. La regla no cambia;
 * cambia quién aporta el número.
 */
export type ConvenioAplicable = {
  id: string;
  nombre: string;
  activacion: ActivacionConvenio;
  beneficio: BeneficioConvenio;
  valor: number | null;
  topePesos: number | null;
  limiteDiario: number | null;
  aplicacionesPreviasHoy: number;
};

/** Por qué un convenio no se aplicó, cuando no se aplicó. */
export type MotivoNoAplicado =
  | "limite_diario"
  /** Lo desplazó una tarifa fija o un sin cobro, que determinan el total solos. */
  | "desplazado";

/** Qué hizo cada convenio, para el desglose. */
export type BeneficioAplicado = {
  convenioId: string;
  nombre: string;
  activacion: ActivacionConvenio;
  beneficio: BeneficioConvenio;
  /** Cuánto restó del total. Cero si no se aplicó. */
  descontado: number;
  /** Minutos que regaló, si el beneficio era de tiempo. */
  minutosRegalados: number;
  /** Si su aporte se recortó por su propio tope en pesos. */
  recortadoPorTope: boolean;
  /** Presente sólo cuando NO se aplicó. */
  noAplicado?: MotivoNoAplicado;
};

/**
 * El cobro con sus convenios, y el porqué de cada cifra.
 *
 * El desglose no es adorno: un total que el operario no puede explicarle al
 * cliente es un problema en plena fila. Por eso incluye también los convenios
 * que NO se aplicaron y su motivo — uno que desaparece sin explicación se lee
 * como una falla del sistema.
 */
export type CobroConConvenios = Cobro & {
  /** Lo que habría costado sin ningún convenio. */
  importeBase: number;
  /** Minutos cobrables antes de que ningún convenio regalara tiempo. */
  minutosBase: number;
  /** Minutos que los convenios acabaron regalando. */
  minutosRegalados: number;
  beneficios: BeneficioAplicado[];
  /** Si la suma de porcentajes llegó al 100 % y hubo que acotarla. */
  sumaPorcentajesAcotada: boolean;
  redondeo: { regla: ReglaRedondeo; restado: number };
};
