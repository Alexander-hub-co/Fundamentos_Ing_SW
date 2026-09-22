import type { PeriodicidadConvenio } from "@/db/esquema";

/**
 * Vigencias declaradas por su duración.
 *
 * PURO: no importa nada de `src/db` salvo el tipo de la enumeración, no lee el
 * reloj y no consulta nada.
 */

/** Cuántos meses dura cada una. */
const MESES: Record<PeriodicidadConvenio, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Cómo se nombra cada una en la interfaz. */
export const NOMBRE_PERIODICIDAD: Record<PeriodicidadConvenio, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/**
 * Cuándo vence un convenio que empieza en `desde` y dura `periodicidad`.
 *
 * SUMA MESES, NO DÍAS. Una mensualidad que empieza el 15 de enero vence el 15
 * de febrero, aunque febrero tenga veintiocho días: lo que se acordó fue un mes,
 * no treinta jornadas.
 *
 * Y recorta al último día del mes destino cuando el día de origen no existe
 * allí. Esto no es una sutileza: `setMonth(mes + 1)` sobre el 31 de enero
 * devuelve el 3 de marzo, porque JavaScript desborda en silencio. Una
 * mensualidad que arranca el 31 de enero vence en febrero, y cobrarle al
 * cliente tres días de más porque el calendario no cuadra es exactamente la
 * clase de error que nadie encuentra revisando.
 */
export function vencimientoDe(desde: Date, periodicidad: PeriodicidadConvenio): Date {
  const meses = MESES[periodicidad];

  const anio = desde.getFullYear();
  const mes = desde.getMonth() + meses;
  const dia = desde.getDate();

  // Día 0 del mes siguiente es el último día del mes destino.
  const ultimoDelDestino = new Date(anio, mes + 1, 0).getDate();

  const resultado = new Date(desde);
  resultado.setFullYear(anio, mes, Math.min(dia, ultimoDelDestino));
  return resultado;
}
