import { asc, eq } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { capacidad, tipoVehiculo } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

export class CapacidadInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "CapacidadInvalida";
  }
}

/**
 * Declara cuántos cupos hay de un tipo de vehículo (FR-023 a FR-025).
 *
 * Es un dato de configuración: cuántos caben. Contar cuántos están ocupados
 * pertenece a F3 y necesita movimientos.
 */
export async function declararCapacidad(
  contexto: Contexto,
  tipoVehiculoId: string,
  cupos: number,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");

  if (!Number.isInteger(cupos) || cupos < 0) {
    throw new CapacidadInvalida("Los cupos deben ser un número entero no negativo");
  }
  if (contexto.tipo !== "establecimiento") {
    throw new CapacidadInvalida("El contexto no pertenece a ningún establecimiento");
  }

  const parqueaderoId = contexto.parqueaderoId;

  await conAmbito(parqueaderoId, async (tx) => {
    const [existente] = await tx
      .select({ id: capacidad.id })
      .from(capacidad)
      .where(eq(capacidad.tipoVehiculoId, tipoVehiculoId))
      .limit(1);

    if (existente) {
      await tx.update(capacidad).set({ cupos }).where(eq(capacidad.id, existente.id));
      return;
    }

    await tx.insert(capacidad).values({ parqueaderoId, tipoVehiculoId, cupos });
  });
}

/** Los cupos declarados, con el nombre de cada tipo. */
export async function capacidadDeclarada(contexto: Contexto) {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ capacidad, tipo: tipoVehiculo })
      .from(capacidad)
      .innerJoin(tipoVehiculo, eq(tipoVehiculo.id, capacidad.tipoVehiculoId))
      .orderBy(asc(tipoVehiculo.orden)),
  );
}
