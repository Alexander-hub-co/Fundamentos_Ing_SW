import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { usuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { revocarSesionesDeCuenta } from "@/dominio/autenticacion/revocar";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { exigirConfirmacionSiEsUltimo } from "./ultimo-administrador";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

/**
 * Bloqueo y desbloqueo de cuentas (FR-036).
 *
 * El bloqueo es INDEPENDIENTE de la suspensión del establecimiento (FR-039):
 * levantar uno no levanta el otro. Son dos motivos distintos —uno personal,
 * otro comercial— y mezclarlos produciría el error de reactivar un
 * establecimiento y devolverle el acceso a alguien que fue bloqueado por su
 * propia conducta.
 */

export async function bloquearCuenta(
  contexto: Contexto,
  datos: { usuarioId: string; motivo?: string; confirmado?: boolean },
): Promise<{ sesionesRevocadas: number }> {
  exigir(contexto, "cuenta.bloquear");
  return bloqueoDeCuenta(contexto, datos);
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
export async function bloqueoDeCuenta(
  contexto: Contexto,
  datos: { usuarioId: string; confirmado?: boolean; motivo?: string },
): Promise<{ sesionesRevocadas: number }> {
  await registrarUsoPrivilegio(contexto, "cuenta.bloquear");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    await exigirConfirmacionSiEsUltimo(
      tx,
      datos.usuarioId,
      "Bloquear esta cuenta",
      datos.confirmado ?? false,
    );

    const actualizadas = await tx
      .update(usuario)
      .set({ banned: true, banReason: datos.motivo ?? null })
      .where(eq(usuario.id, datos.usuarioId))
      .returning({ id: usuario.id });

    if (actualizadas.length === 0) {
      throw await errorDeAlcance(contexto, `cuenta:${datos.usuarioId}`);
    }

    // FR-004: la sesión en curso deja de tener acceso sin esperar a que expire.
    const sesionesRevocadas = await revocarSesionesDeCuenta(tx, datos.usuarioId);

    return { sesionesRevocadas };
  });
}

export async function desbloquearCuenta(
  contexto: Contexto,
  datos: { usuarioId: string },
): Promise<void> {
  exigir(contexto, "cuenta.bloquear");
  return desbloqueoDeCuenta(contexto, datos);
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
export async function desbloqueoDeCuenta(
  contexto: Contexto,
  datos: { usuarioId: string },
): Promise<void> {
  await registrarUsoPrivilegio(contexto, "cuenta.desbloquear");

  await comoPlataforma("administracion_plataforma", async (tx) => {
    const actualizadas = await tx
      .update(usuario)
      .set({ banned: false, banReason: null })
      .where(eq(usuario.id, datos.usuarioId))
      .returning({ id: usuario.id });

    if (actualizadas.length === 0) {
      throw await errorDeAlcance(contexto, `cuenta:${datos.usuarioId}`);
    }
  });

  // Nota deliberada: desbloquear NO toca el estado del establecimiento. Si
  // estaba suspendido, la cuenta sigue sin acceso operativo — y eso es
  // correcto (FR-039).
}
