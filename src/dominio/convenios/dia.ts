import type { PeriodicidadConvenio } from "@/db/esquema";

/**
 * Contra qué día se cuenta el límite diario de un convenio.
 *
 * PURO: no lee el reloj, no consulta nada. Recibe el instante y devuelve el día.
 *
 * "Al día" significa el día CALENDARIO en la zona del establecimiento, de
 * medianoche a medianoche, y no una ventana móvil de veinticuatro horas. Es lo
 * que entiende quien lleva la contabilidad y lo que un operario puede
 * explicarle a un cliente que reclama.
 *
 * Y se cuenta contra el día de la SALIDA, porque es el instante en que el
 * convenio se aplica y se cobra. Un carro que entró el martes a las once de la
 * noche y salió el miércoles a las dos de la mañana gasta el cupo del
 * miércoles. Coincide con el instante en que ya se evaluaba la vigencia: un
 * solo momento de evaluación para todo, para que el mismo movimiento no pueda
 * tener dos respuestas.
 */

const ZONA = "America/Bogota";

/**
 * El día calendario, como `AAAA-MM-DD` en la zona del establecimiento.
 *
 * Se devuelve como texto y no como `Date` a propósito: un `Date` volvería a
 * traer una hora y una zona, que es justamente lo que acá hay que haber
 * resuelto ya. Dos instantes del mismo día dan la misma cadena, y comparar
 * cadenas no admite ambigüedad.
 */
export function diaDeAplicacion(momento: Date): string {
  // `en-CA` produce el formato AAAA-MM-DD, que además ordena bien como texto.
  return momento.toLocaleDateString("en-CA", { timeZone: ZONA });
}

/** Cómo se le muestra ese día a una persona. */
export function diaLegible(dia: string): string {
  const [anio, mes, d] = dia.split("-").map((n) => Number.parseInt(n, 10));
  return new Date(anio!, mes! - 1, d!).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Se reexporta para que quien use el día no tenga que buscar la vigencia aparte. */
export type { PeriodicidadConvenio };
