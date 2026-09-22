import { desc, eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { cambioEstado, usuario } from "@/db/esquema";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Tx } from "@/db/ambito";

/**
 * Historial de cambios de estado (FR-026).
 *
 * Se conserva aunque el establecimiento cambie de estado después: es la prueba
 * de por qué le cortaste el servicio a un cliente y cuándo. En una discusión
 * comercial, ese asiento es lo único que queda.
 */

export async function anotarCambioEstado(
  tx: Tx,
  datos: {
    parqueaderoId: string;
    estadoAnterior: EstadoParqueadero;
    estadoNuevo: EstadoParqueadero;
    motivo: string;
    ejecutadoPor: string;
  },
): Promise<void> {
  await tx.insert(cambioEstado).values({
    parqueaderoId: datos.parqueaderoId,
    estadoAnterior: datos.estadoAnterior,
    estadoNuevo: datos.estadoNuevo,
    motivo: datos.motivo,
    ejecutadoPor: datos.ejecutadoPor,
  });
}

export type AsientoHistorial = {
  estadoAnterior: string | null;
  estadoNuevo: string;
  motivo: string;
  ocurridoEn: Date;
  ejecutadoPor: string | null;
};

/** Historial completo de un establecimiento, del más reciente al más antiguo. */
export async function historialDeEstados(
  parqueaderoId: string,
): Promise<AsientoHistorial[]> {
  return comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select({
        estadoAnterior: cambioEstado.estadoAnterior,
        estadoNuevo: cambioEstado.estadoNuevo,
        motivo: cambioEstado.motivo,
        ocurridoEn: cambioEstado.ocurridoEn,
        ejecutadoPor: usuario.name,
      })
      .from(cambioEstado)
      .leftJoin(usuario, eq(usuario.id, cambioEstado.ejecutadoPor))
      .where(eq(cambioEstado.parqueaderoId, parqueaderoId))
      .orderBy(desc(cambioEstado.ocurridoEn)),
  );
}
