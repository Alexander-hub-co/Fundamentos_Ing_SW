import type { ReglaRedondeo } from "@/db/esquema";

/**
 * Redondeo de importes.
 *
 * PURO: no importa nada de `src/db` salvo el tipo de la enumeración, no lee el
 * reloj y no consulta nada.
 *
 * La regla es configuración del establecimiento y no una constante del sistema
 * porque el Principio II nombra explícitamente las "reglas de redondeo" entre
 * lo que cada parqueadero decide. Hubo una versión de la especificación que
 * argumentaba lo contrario; se descartó por lo que era, una interpretación a
 * conveniencia de un principio escrito sin ambigüedad.
 */

/**
 * Valor por defecto de un establecimiento que no declaró el suyo.
 *
 * Es el dato de inicialización marcado como tal que exige el Principio II, y es
 * sobrescribible: cualquier administrador puede cambiarlo desde su pantalla de
 * configuración.
 *
 * Se elige el más conservador de los tres. Redondear a la cincuentena o a la
 * centena es una decisión de caja que quien vende el servicio tiene que tomar a
 * conciencia, no algo que le aparezca puesto sin haberlo pedido.
 */
export const REDONDEO_INICIAL: ReglaRedondeo = "peso";

/** A cuántos pesos redondea cada regla. */
const PASO: Record<ReglaRedondeo, number> = {
  peso: 1,
  cincuentena: 50,
  centena: 100,
};

/**
 * Aplica la regla a un importe.
 *
 * SIEMPRE HACIA ABAJO, y ésa es la garantía que importa (FR-011b): el redondeo
 * puede favorecer al cliente, nunca al establecimiento. Aproximar al más
 * cercano cobraría pesos que ningún cálculo produjo, y ése es exactamente el
 * problema contable que la regla existe para evitar.
 *
 * Con `peso` el paso es uno, así que un importe entero sale intacto. No es un
 * caso especial: es la misma fórmula.
 */
export function redondear(importe: number, regla: ReglaRedondeo): number {
  const paso = PASO[regla];
  return Math.floor(importe / paso) * paso;
}
