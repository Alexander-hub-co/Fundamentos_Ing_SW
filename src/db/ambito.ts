import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { dbPlatform, dbTenant } from "./pools";
import * as esquema from "./esquema";

/**
 * ============================================================================
 * LA FRONTERA DE SEGURIDAD DE PARQUIVO
 * ============================================================================
 *
 * Existen exactamente dos formas de tocar la base de datos, y ninguna otra está
 * permitida. Cualquier consulta que no pase por una de las dos es un defecto, y
 * la revisión debe tratarlo como tal.
 *
 * Por qué la transacción es obligatoria y no una preferencia de estilo:
 * `set_config(..., true)` sólo vive dentro de una transacción. Una consulta
 * ejecutada fuera de ese marco no ve la variable, y la política RLS la evalúa
 * como si no hubiera ámbito. El diseño fallaría abriendo si esta regla se
 * relajara — de ahí FR-012.
 *
 * Ver specs/001-gestion-parqueaderos/contracts/operaciones.md.
 */

export type Tx = Parameters<
  Parameters<NodePgDatabase<typeof esquema>["transaction"]>[0]
>[0];

/**
 * Conjunto cerrado de motivos para atravesar el aislamiento.
 *
 * No es un parámetro decorativo: es lo que hace auditable el uso del
 * privilegio, como exige FR-013. Ampliar este tipo es una decisión de
 * arquitectura, no un detalle de implementación.
 */
export type MotivoPrivilegiado =
  /** Resolver un correo a una cuenta ocurre ANTES de que exista un ámbito. */
  | "autenticacion"
  /** Operaciones del administrador general, que por definición son globales. */
  | "administracion_plataforma";

/**
 * Ejecuta `fn` dentro de una transacción con el ámbito de un establecimiento
 * fijado. Es el único camino para datos de establecimiento.
 *
 * El identificador viene SIEMPRE de la sesión autenticada, nunca de un valor
 * que el cliente pueda enviar o modificar (FR-009). Este módulo no lo verifica
 * porque no puede: es responsabilidad de `lib/sesion.ts` ser la única fuente.
 */
export async function conAmbito<T>(
  parqueaderoId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return dbTenant().transaction(async (tx) => {
    // Antes de cualquier otra consulta. El tercer argumento `true` limita el
    // valor a esta transacción, que es lo que hace compatible el diseño con la
    // agrupación de conexiones en modo transacción de las plataformas
    // gestionadas.
    await tx.execute(
      sql`select set_config('app.parqueadero_id', ${parqueaderoId}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Ejecuta `fn` con la conexión privilegiada, que atraviesa RLS.
 *
 * Cada invocación declara su motivo y queda registrada. Si aparece una llamada
 * fuera del módulo de autenticación o de las operaciones de plataforma, es un
 * hallazgo de seguridad — y la prueba V5 del quickstart lo verifica de forma
 * automatizada.
 */
export async function comoPlataforma<T>(
  motivo: MotivoPrivilegiado,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  registrarUsoPrivilegiado(motivo);
  return dbPlatform().transaction(async (tx) => fn(tx));
}

function registrarUsoPrivilegiado(motivo: MotivoPrivilegiado) {
  // Deliberadamente simple por ahora. Cuando exista observabilidad real, este
  // es el único punto que hay que cambiar para auditar todo ejercicio del
  // privilegio global.
  if (process.env.NODE_ENV !== "test") {
    console.info(`[privilegio] ${motivo}`);
  }
}
