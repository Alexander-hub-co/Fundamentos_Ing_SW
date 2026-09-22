import { and, eq, ne } from "drizzle-orm";
import { asignacion } from "@/db/esquema";
import type { Tx } from "@/db/ambito";

/**
 * Protección del último administrador (FR-037).
 *
 * Bloquear, dar de baja o anonimizar a la única persona administradora de un
 * establecimiento lo deja sin responsable: nadie podría configurarlo ni dar de
 * alta operarios. No se prohíbe —a veces es lo que se quiere— pero se exige
 * confirmación explícita.
 *
 * Cubre también el caso de retirar la asignación, que produce exactamente la
 * misma situación aunque la cuenta siga existiendo.
 */

export class RequiereConfirmacion extends Error {
  readonly codigo = "REQUIERE_CONFIRMACION";
  constructor(readonly detalle: string) {
    super(detalle);
    this.name = "RequiereConfirmacion";
  }
}

/**
 * ¿Esta cuenta es la última administradora de su establecimiento?
 *
 * Devuelve `null` si no aplica: cuentas globales, operarios, o cuentas sin
 * asignación.
 */
export async function esUltimoAdministrador(
  tx: Tx,
  usuarioId: string,
): Promise<{ parqueaderoId: string } | null> {
  const [vinculo] = await tx
    .select({ parqueaderoId: asignacion.parqueaderoId, rol: asignacion.rol })
    .from(asignacion)
    .where(eq(asignacion.usuarioId, usuarioId))
    .limit(1);

  if (!vinculo?.parqueaderoId || vinculo.rol !== "admin_parqueadero") return null;

  const otros = await tx
    .select({ id: asignacion.id })
    .from(asignacion)
    .where(
      and(
        eq(asignacion.parqueaderoId, vinculo.parqueaderoId),
        eq(asignacion.rol, "admin_parqueadero"),
        ne(asignacion.usuarioId, usuarioId),
      ),
    )
    .limit(1);

  return otros.length === 0 ? { parqueaderoId: vinculo.parqueaderoId } : null;
}

/**
 * Exige confirmación si la acción dejaría al establecimiento sin responsable.
 *
 * `accion` se usa en el mensaje para que la advertencia diga qué se está por
 * hacer, no un genérico "esto es peligroso".
 */
export async function exigirConfirmacionSiEsUltimo(
  tx: Tx,
  usuarioId: string,
  accion: string,
  confirmado: boolean,
): Promise<void> {
  if (confirmado) return;

  const esUltimo = await esUltimoAdministrador(tx, usuarioId);
  if (!esUltimo) return;

  throw new RequiereConfirmacion(
    `${accion} dejaría al establecimiento sin ninguna persona administradora. ` +
      `Confirme explícitamente para continuar.`,
  );
}
