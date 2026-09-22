import type { Contexto } from "@/lib/sesion";
import { cambiarEstadoParqueadero, type ResultadoCambio } from "./cambiar-estado";

/**
 * Reactivación de un establecimiento (FR-029).
 *
 * "Restituir el acceso pleno" tiene tres partes, y las tres importan:
 *
 *   1. El estado vuelve a `activo`, lo que levanta el modo restringido.
 *   2. Ningún dato se perdió durante la suspensión — nunca se borró nada, así
 *      que no hay nada que restaurar. Eso es consecuencia del Principio IV, no
 *      de un paso de esta función.
 *   3. Las sesiones se revocan para que la siguiente se construya con el estado
 *      vigente. El usuario vuelve a entrar y encuentra todo como lo dejó.
 *
 * Sirve tanto para levantar una suspensión como para revivir un establecimiento
 * dado de baja, que es la única salida del estado terminal (FR-041).
 *
 * NO duplica el cambio de estado: delega en él. La interfaz reactiva desde la
 * pantalla genérica de estados, así que esta función no tiene consumidor en la
 * aplicación; existe porque "reactivar" es una operación con nombre propio en
 * la especificación y conviene que el código la nombre igual. Las pruebas de
 * FR-029 entran por acá.
 */
export async function reactivarParqueadero(
  contexto: Contexto,
  datos: { parqueaderoId: string; motivo: string },
): Promise<ResultadoCambio> {
  return cambiarEstadoParqueadero(contexto, {
    parqueaderoId: datos.parqueaderoId,
    nuevoEstado: "activo",
    motivo: datos.motivo,
  });
}
