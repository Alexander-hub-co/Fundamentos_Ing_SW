import {
  DEMORA_BASE_MS,
  DEMORA_MAXIMA_MS,
  FACTOR_CRECIMIENTO,
  INTENTOS_SIN_PENALIZACION,
} from "./parametros";

/**
 * Cálculo de la demora progresiva (FR-006, FR-007).
 *
 * Función pura: recibe cuántos fallos consecutivos hubo y devuelve cuánto hay
 * que esperar. Así se puede probar la curva completa sin base de datos ni
 * relojes falsos.
 *
 * La progresión es 0, 0, 0, 2s, 4s, 8s, 16s, 30s, 30s… El tope es lo que hace
 * que la cuenta nunca quede inaccesible de forma permanente: por muchos fallos
 * que se acumulen, esperando medio minuto siempre se puede volver a intentar.
 */
export function demoraPara(fallosConsecutivos: number): number {
  if (fallosConsecutivos <= INTENTOS_SIN_PENALIZACION) return 0;

  const penalizados = fallosConsecutivos - INTENTOS_SIN_PENALIZACION;
  const espera = DEMORA_BASE_MS * FACTOR_CRECIMIENTO ** (penalizados - 1);

  return Math.min(espera, DEMORA_MAXIMA_MS);
}

/**
 * Milisegundos que faltan para poder reintentar.
 *
 * Devuelve 0 si ya se puede. Compara contra el último fallo, no contra el
 * primero: cada intento nuevo reinicia la cuenta atrás, que es lo que vuelve
 * inviable el ataque automatizado.
 */
export function esperaRestante(
  fallosConsecutivos: number,
  ultimoFallo: Date | null,
  ahora: Date = new Date(),
): number {
  if (!ultimoFallo) return 0;

  const demora = demoraPara(fallosConsecutivos);
  if (demora === 0) return 0;

  const transcurrido = ahora.getTime() - ultimoFallo.getTime();
  return Math.max(0, demora - transcurrido);
}
