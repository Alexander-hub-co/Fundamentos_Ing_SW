/**
 * El vocabulario de las preferencias, sin nada alrededor.
 *
 * Vive aparte de `gestionar.ts` porque el formulario de Ajustes es un componente
 * de CLIENTE y necesita estos valores. Importarlos del módulo que habla con la
 * base de datos arrastraba el controlador de PostgreSQL al paquete del
 * navegador; separarlo es lo que lo impide, y no una cuestión de orden.
 *
 * Es además la fuente única: los enumerados de la base se declaran a partir de
 * estas listas, así que agregar una opción acá y olvidarla allá no es posible.
 */

export const TEMAS = ["claro", "oscuro"] as const;
export const ACENTOS = ["verde", "azul", "marino"] as const;
export const DENSIDADES = ["densa", "comoda"] as const;

export type TemaVisual = (typeof TEMAS)[number];
export type AcentoVisual = (typeof ACENTOS)[number];
export type DensidadTaquilla = (typeof DENSIDADES)[number];

/**
 * Anchos de rollo de las térmicas de factura. Lista CERRADA: son los dos
 * formatos que existen en el comercio, y escribir un número libre sólo permite
 * equivocarse.
 */
export const ANCHOS_ROLLO = [58, 80] as const;
export type AnchoRollo = (typeof ANCHOS_ROLLO)[number];

export type Preferencias = {
  tema: TemaVisual;
  acento: AcentoVisual;
  densidad: DensidadTaquilla;
  /** Alto del campo de placa, en píxeles. */
  tamanoPlaca: number;
  confirmarCobro: boolean;
  /**
   * Mandar el ticket a la impresora sin pulsar nada.
   *
   * En la SALIDA es sólo el valor de partida de la pregunta que se le hace al
   * operario en el momento: el recibo se decide con el cliente delante, no una
   * vez en una pantalla de ajustes.
   */
  imprimirAuto: boolean;
  /** Ancho del rollo de la térmica de esta caseta, en milímetros. */
  anchoRollo: AnchoRollo;
};

/**
 * Con qué se ve Parquivo antes de que nadie elija.
 *
 * Oscuro porque las pantallas están dibujadas sobre fondo oscuro y la taquilla
 * se atiende muchas horas seguidas, a menudo de noche y con poca luz. Densa
 * porque quien atiende quiere ver quién está adentro sin cambiar de pantalla.
 * Y sin confirmación, porque el paso extra se justifica cuando alguien lo pide,
 * no de entrada.
 */
export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  tema: "oscuro",
  acento: "verde",
  densidad: "densa",
  tamanoPlaca: 64,
  confirmarCobro: false,
  // Apagado de partida: hasta que alguien confirme que la impresora de ESTA
  // caseta responde, mandar cada movimiento a imprimir sólo produce diálogos.
  // Se enciende en Ajustes cuando la impresión ya se probó.
  imprimirAuto: false,
  anchoRollo: 58,
};

/** Límites del campo de placa. Iguales a los del CHECK de la tabla. */
export const PLACA_MINIMA = 40;
export const PLACA_MAXIMA = 96;

export function esTema(valor: unknown): valor is TemaVisual {
  return TEMAS.includes(valor as TemaVisual);
}

export function esAcento(valor: unknown): valor is AcentoVisual {
  return ACENTOS.includes(valor as AcentoVisual);
}

export function esDensidad(valor: unknown): valor is DensidadTaquilla {
  return DENSIDADES.includes(valor as DensidadTaquilla);
}

export function esAnchoRollo(valor: unknown): valor is AnchoRollo {
  return ANCHOS_ROLLO.includes(valor as AnchoRollo);
}
