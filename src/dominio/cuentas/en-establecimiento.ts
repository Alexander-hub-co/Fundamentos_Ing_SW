import { eq } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { asignacion, usuario } from "@/db/esquema";
import type { RolUsuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { altaDeCuenta, AmbitoInvalido } from "./crear";
import { bloqueoDeCuenta, desbloqueoDeCuenta } from "./bloqueo";
import { restablecimientoDePassword } from "./restablecer";
import { bajaDeCuenta } from "./dar-de-baja";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

/**
 * Gestión del equipo por el propio establecimiento (US3).
 *
 * Todo lo de acá está acotado al establecimiento de la sesión. La comprobación
 * de pertenencia se apoya en la RLS: si la cuenta no aparece consultando con el
 * ámbito puesto, es de otro local, y eso se responde igual que si no existiera.
 */

type RolDelLocal = Exclude<RolUsuario, "admin_general">;

/** Da de alta una cuenta en el propio establecimiento (FR-046 a FR-050). */
export async function crearCuentaEnMiEstablecimiento(
  contexto: Contexto,
  datos: { email: string; nombre: string; passwordTemporal: string; rol: RolDelLocal },
): Promise<{ usuarioId: string; codigo: string }> {
  exigir(contexto, "cuenta.crear.propia");

  if (contexto.tipo !== "establecimiento") {
    throw new AmbitoInvalido("El contexto no pertenece a ningún establecimiento");
  }

  // El rol de plataforma no se puede otorgar desde un establecimiento, y el
  // parqueadero no llega por parámetro: sale de la sesión. Un dato que no se
  // recibe no se puede manipular.
  if ((datos.rol as RolUsuario) === "admin_general") {
    throw new AmbitoInvalido(
      "Un administrador de establecimiento no puede crear cuentas de plataforma",
    );
  }

  return altaDeCuenta(contexto, {
    email: datos.email,
    nombre: datos.nombre,
    passwordTemporal: datos.passwordTemporal,
    rol: datos.rol,
    parqueaderoId: contexto.parqueaderoId,
  });
}

/**
 * Asciende a alguien del establecimiento a administrador (FR-051, FR-052).
 *
 * Amplía el rol dentro del local; nunca el ámbito. Fue la decisión de
 * clarificación: el dueño de un parqueadero no debería tener que llamar a la
 * plataforma para poner de administrador a su encargado de confianza.
 */
export async function cambiarRolEnMiEstablecimiento(
  contexto: Contexto,
  usuarioId: string,
  rol: RolDelLocal,
): Promise<void> {
  exigir(contexto, "cuenta.gestionar.propia");

  if (contexto.tipo !== "establecimiento") {
    throw new AmbitoInvalido("El contexto no pertenece a ningún establecimiento");
  }

  await exigirDeMiEstablecimiento(contexto, usuarioId);

  await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.update(asignacion).set({ rol }).where(eq(asignacion.usuarioId, usuarioId)),
  );
}

export type AccionSobreCuentaPropia =
  | "bloquear"
  | "desbloquear"
  | "restablecer"
  | "dar_de_baja";

/**
 * Bloquear, desbloquear, restablecer o dar de baja, acotado al propio local.
 *
 * El orden importa y no es casual: primero se exige el permiso, después se
 * comprueba que la cuenta sea de este establecimiento, y sólo entonces se llama
 * a la mecánica. Las tres cosas por separado —quién puede, sobre qué, y cómo—
 * en vez de una función que las mezcle.
 */
export async function gestionarCuentaDeMiEstablecimiento(
  contexto: Contexto,
  accion: AccionSobreCuentaPropia,
  datos: { usuarioId: string; passwordTemporal?: string; motivo?: string },
): Promise<void> {
  exigir(contexto, "cuenta.gestionar.propia");
  await exigirDeMiEstablecimiento(contexto, datos.usuarioId);

  switch (accion) {
    case "bloquear":
      await bloqueoDeCuenta(contexto, {
        usuarioId: datos.usuarioId,
        confirmado: true,
        motivo: datos.motivo,
      });
      return;
    case "desbloquear":
      await desbloqueoDeCuenta(contexto, { usuarioId: datos.usuarioId });
      return;
    case "restablecer":
      await restablecimientoDePassword(contexto, {
        usuarioId: datos.usuarioId,
        passwordTemporal: datos.passwordTemporal ?? "",
      });
      return;
    case "dar_de_baja":
      await bajaDeCuenta(contexto, {
        usuarioId: datos.usuarioId,
        confirmado: true,
        motivo: datos.motivo,
      });
      return;
  }
}

/** El equipo del establecimiento. */
export async function miEquipo(contexto: Contexto) {
  // Administración, no operación: la lista trae el correo de cada compañero,
  // quién está bloqueado y quién sigue con contraseña temporal. Un operario no
  // necesita nada de eso para atender un carro.
  exigir(contexto, "establecimiento.administrar.ver");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({
        id: usuario.id,
        codigo: usuario.codigo,
        nombre: usuario.name,
        email: usuario.email,
        rol: asignacion.rol,
        bloqueada: usuario.banned,
        // Sólo lo hay cuando el bloqueo vino de dar de baja; bloquear a mano
        // todavía no pide motivo. Se lee igual: cuando existe, la pantalla
        // puede decir POR QUÉ está bloqueada en vez de sólo que lo está.
        motivoBloqueo: usuario.banReason,
        debeCambiarPassword: usuario.debeCambiarPassword,
        anonimizadaEn: usuario.anonimizadaEn,
      })
      .from(asignacion)
      .innerJoin(usuario, eq(usuario.id, asignacion.usuarioId))
      .orderBy(usuario.codigo),
  );
}

/**
 * Una cuenta de otro establecimiento responde igual que una inexistente.
 *
 * Se consulta con el ámbito puesto: la RLS deja fuera a las ajenas, así que la
 * ausencia significa las dos cosas a la vez y no hay forma de distinguirlas
 * (FR-011).
 */
async function exigirDeMiEstablecimiento(
  contexto: Contexto,
  usuarioId: string,
): Promise<void> {
  if (contexto.tipo !== "establecimiento") return;

  const [vinculo] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ id: asignacion.id })
      .from(asignacion)
      .where(eq(asignacion.usuarioId, usuarioId))
      .limit(1),
  );

  if (!vinculo) throw await errorDeAlcance(contexto, `cuenta:${usuarioId}`);
}
