import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, type EstadoParqueadero, type Parqueadero } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { revocarSesionesDeEstablecimiento } from "@/dominio/autenticacion/revocar";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { exigirTransicion } from "./estados";
import { anotarCambioEstado } from "./historial-estado";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export class MotivoRequerido extends Error {
  constructor() {
    super(
      "Todo cambio de estado exige un motivo: es la única constancia de por " +
        "qué se le cortó o restituyó el servicio a un cliente (FR-026).",
    );
    this.name = "MotivoRequerido";
  }
}

export type ResultadoCambio = {
  parqueadero: Parqueadero;
  sesionesRevocadas: number;
};

/**
 * Cambia el estado de un establecimiento (FR-025).
 *
 * Las tres cosas ocurren en la misma transacción a propósito: si el estado
 * cambiara pero el asiento del historial no llegara a escribirse, quedaría un
 * corte de servicio sin explicación. Y si las sesiones no se revocaran, la
 * suspensión no surtiría efecto hasta que expiraran solas.
 */
export async function cambiarEstadoParqueadero(
  contexto: Contexto,
  datos: {
    parqueaderoId: string;
    nuevoEstado: EstadoParqueadero;
    motivo: string;
  },
): Promise<ResultadoCambio> {
  exigir(contexto, "parqueadero.cambiar_estado");

  const motivo = datos.motivo.trim();
  if (motivo.length === 0) throw new MotivoRequerido();

  await registrarUsoPrivilegio(contexto, "parqueadero.cambiar_estado");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [actual] = await tx
      .select({ estado: parqueadero.estado })
      .from(parqueadero)
      .where(eq(parqueadero.id, datos.parqueaderoId))
      .limit(1);

    if (!actual) throw await errorDeAlcance(contexto, `parqueadero:${datos.parqueaderoId}`);

    exigirTransicion(actual.estado, datos.nuevoEstado);

    const [actualizado] = await tx
      .update(parqueadero)
      .set({ estado: datos.nuevoEstado, actualizadoEn: new Date() })
      .where(eq(parqueadero.id, datos.parqueaderoId))
      .returning();

    await anotarCambioEstado(tx, {
      parqueaderoId: datos.parqueaderoId,
      estadoAnterior: actual.estado,
      estadoNuevo: datos.nuevoEstado,
      motivo,
      ejecutadoPor: contexto.usuarioId,
    });

    // Toda transición revoca sesiones, incluida la reactivación: así la sesión
    // se reconstruye con el estado vigente en vez de arrastrar el anterior.
    const sesionesRevocadas = await revocarSesionesDeEstablecimiento(
      tx,
      datos.parqueaderoId,
    );

    return { parqueadero: actualizado!, sesionesRevocadas };
  });
}
