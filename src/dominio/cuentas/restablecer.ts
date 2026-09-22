import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { usuario } from "@/db/esquema";
import { fijarPassword } from "@/dominio/autenticacion/password";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { revocarSesionesDeCuenta } from "@/dominio/autenticacion/revocar";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

/**
 * Restablece la contraseña de una cuenta a una temporal nueva (FR-034).
 *
 * Es el ÚNICO camino de recuperación que existe en Parquivo: no hay
 * "olvidé mi contraseña" autogestionado (FR-035), porque la plataforma no
 * envía correo y una recuperación sin canal de verificación sería un agujero.
 *
 * Vuelve a exigir el cambio en el siguiente ingreso, así que la clave que el
 * administrador general entrega sólo sirve una vez.
 */
export async function restablecerPassword(
  contexto: Contexto,
  datos: { usuarioId: string; passwordTemporal: string },
): Promise<{ sesionesRevocadas: number }> {
  exigir(contexto, "cuenta.restablecer_password");
  return restablecimientoDePassword(contexto, datos);
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
export async function restablecimientoDePassword(
  contexto: Contexto,
  datos: { usuarioId: string; passwordTemporal: string },
): Promise<{ sesionesRevocadas: number }> {
  await registrarUsoPrivilegio(contexto, "cuenta.restablecer_password");

  const [existente] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select({ id: usuario.id, anonimizadaEn: usuario.anonimizadaEn })
      .from(usuario)
      .where(eq(usuario.id, datos.usuarioId))
      .limit(1),
  );

  if (!existente || existente.anonimizadaEn) {
    throw await errorDeAlcance(contexto, `cuenta:${datos.usuarioId}`);
  }

  await fijarPassword(datos.usuarioId, datos.passwordTemporal);

  return comoPlataforma("administracion_plataforma", async (tx) => {
    await tx
      .update(usuario)
      .set({ debeCambiarPassword: true })
      .where(eq(usuario.id, datos.usuarioId));

    // Las sesiones abiertas con la contraseña vieja dejan de valer: si no se
    // revocaran, restablecer no expulsaría a quien ya estaba dentro.
    const sesionesRevocadas = await revocarSesionesDeCuenta(tx, datos.usuarioId);
    return { sesionesRevocadas };
  });
}
