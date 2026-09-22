import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { cambiarEstadoParqueadero, type ResultadoCambio } from "./cambiar-estado";

export class BajaRequiereConfirmacion extends Error {
  readonly codigo = "REQUIERE_CONFIRMACION";
  constructor() {
    super(
      "Dar de baja un establecimiento le retira todo acceso a sus usuarios. " +
        "Confirme explícitamente para continuar.",
    );
    this.name = "BajaRequiereConfirmacion";
  }
}

/**
 * Baja lógica del establecimiento (FR-040, FR-041).
 *
 * Nunca hay borrado físico. La baja es llevarlo al estado terminal: deja de
 * operar y de aparecer en los listados activos, pero su información —y todo su
 * historial— se conserva íntegra. Lo impone el Principio IV.
 *
 * Exige confirmación por la misma razón que la protección del último
 * administrador: es una acción que corta el servicio de un cliente entero y no
 * debe poder ejecutarse de un clic accidental.
 */
export async function darDeBajaParqueadero(
  contexto: Contexto,
  datos: { parqueaderoId: string; motivo: string; confirmado?: boolean },
): Promise<ResultadoCambio> {
  exigir(contexto, "parqueadero.dar_de_baja");

  if (!datos.confirmado) throw new BajaRequiereConfirmacion();

  return cambiarEstadoParqueadero(contexto, {
    parqueaderoId: datos.parqueaderoId,
    nuevoEstado: "dado_de_baja",
    motivo: datos.motivo,
  });
}
