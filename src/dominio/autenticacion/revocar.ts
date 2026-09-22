import { eq, inArray } from "drizzle-orm";
import { asignacion, sesion } from "@/db/esquema";
import type { Tx } from "@/db/ambito";

/**
 * Revocación de sesiones.
 *
 * SC-004 exige que un cambio de estado alcance a las sesiones ya abiertas en
 * menos de un minuto. La forma de lograrlo no es esperar a que expiren sino
 * borrarlas: las sesiones viven en la base, así que eliminarlas surte efecto en
 * la siguiente petición.
 *
 * Es también lo que sostiene FR-004 cuando se bloquea una cuenta.
 */

/** Revoca todas las sesiones de una cuenta. */
export async function revocarSesionesDeCuenta(
  tx: Tx,
  usuarioId: string,
): Promise<number> {
  const borradas = await tx
    .delete(sesion)
    .where(eq(sesion.userId, usuarioId))
    .returning({ id: sesion.id });
  return borradas.length;
}

/**
 * Revoca las sesiones de todas las cuentas de un establecimiento.
 *
 * Se usa al suspender, al dar de baja y al reactivar. En el caso de la
 * reactivación puede parecer innecesario —el usuario recupera acceso— pero
 * forzar un inicio de sesión nuevo garantiza que la sesión se reconstruya con
 * el estado vigente en lugar de arrastrar el anterior.
 */
export async function revocarSesionesDeEstablecimiento(
  tx: Tx,
  parqueaderoId: string,
): Promise<number> {
  const cuentas = await tx
    .select({ usuarioId: asignacion.usuarioId })
    .from(asignacion)
    .where(eq(asignacion.parqueaderoId, parqueaderoId));

  if (cuentas.length === 0) return 0;

  const borradas = await tx
    .delete(sesion)
    .where(
      inArray(
        sesion.userId,
        cuentas.map((c) => c.usuarioId),
      ),
    )
    .returning({ id: sesion.id });

  return borradas.length;
}
