import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, usuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { revocarSesionesDeCuenta } from "@/dominio/autenticacion/revocar";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { exigirConfirmacionSiEsUltimo } from "./ultimo-administrador";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

/**
 * Baja lógica de una cuenta (FR-038, FR-042).
 *
 * NUNCA hay borrado físico. La fila del usuario permanece porque el historial
 * la referencia —quién cambió qué estado, quién ejecutó qué operación— y
 * destruirla dejaría asientos huérfanos. Lo impone el Principio IV, y la base
 * lo respalda: las claves foráneas del historial impiden el DELETE.
 *
 * Dar de baja es retirar el acceso: se bloquea la cuenta, se revocan sus
 * sesiones y se retira su asignación, de modo que ya no pertenece a ningún
 * establecimiento.
 */
export async function darDeBajaCuenta(
  contexto: Contexto,
  datos: { usuarioId: string; motivo?: string; confirmado?: boolean },
): Promise<{ sesionesRevocadas: number }> {
  exigir(contexto, "cuenta.dar_de_baja");
  return bajaDeCuenta(contexto, datos);
}

/**
 * La mecánica, sin decidir quién puede ejecutarla.
 *
 * Hay dos caminos legítimos con permisos distintos: el administrador general
 * sobre cualquier cuenta, y el administrador de un local sobre las suyas. Cada
 * uno exige SU operación y comprueba lo que le toca antes de llegar acá; lo que
 * comparten es el cómo, no el quién.
 *
 * No se resolvió ampliando los roles de la operación de plataforma: esa acepta
 * cualquier `usuarioId`, así que dársela al administrador de un local le
 * permitiría alcanzar cuentas ajenas.
 */
export async function bajaDeCuenta(
  contexto: Contexto,
  datos: { usuarioId: string; confirmado?: boolean; motivo?: string },
): Promise<{ sesionesRevocadas: number }> {
  await registrarUsoPrivilegio(contexto, "cuenta.dar_de_baja");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [existente] = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(eq(usuario.id, datos.usuarioId))
      .limit(1);

    if (!existente) throw await errorDeAlcance(contexto, `cuenta:${datos.usuarioId}`);

    await exigirConfirmacionSiEsUltimo(
      tx,
      datos.usuarioId,
      "Dar de baja esta cuenta",
      datos.confirmado ?? false,
    );

    await tx
      .update(usuario)
      .set({ banned: true, banReason: datos.motivo ?? "Cuenta dada de baja" })
      .where(eq(usuario.id, datos.usuarioId));

    // Se retira la asignación: la cuenta deja de pertenecer a un
    // establecimiento. La fila del usuario, en cambio, se conserva.
    await tx.delete(asignacion).where(eq(asignacion.usuarioId, datos.usuarioId));

    const sesionesRevocadas = await revocarSesionesDeCuenta(tx, datos.usuarioId);
    return { sesionesRevocadas };
  });
}
