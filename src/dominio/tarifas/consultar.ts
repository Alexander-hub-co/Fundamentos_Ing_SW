import { and, asc, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { conAmbito, comoPlataforma } from "@/db/ambito";
import { tarifa, tipoVehiculo, type Tarifa, type TipoVehiculo } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import type { TarifaAplicable } from "./modelos";

/**
 * Consulta de tarifas.
 *
 * La lectura se permite con el establecimiento suspendido: el modo restringido
 * impide cambiar las reglas, no consultarlas.
 */

/** Convierte la fila de la base al tipo que entiende el calculador. */
export function aTarifaAplicable(fila: Tarifa): TarifaAplicable {
  const comun = { tarifaPlena: fila.tarifaPlena, alcancePlena: fila.alcancePlena };

  if (fila.modelo === "por_minuto") {
    return {
      ...comun,
      modelo: "por_minuto",
      // El CHECK de la tabla garantiza que no son nulos en este modelo; el
      // `??` está para que TypeScript lo sepa, no porque pueda ocurrir.
      tarifaMinima: fila.tarifaMinima ?? 0,
      valorMinuto: fila.valorMinuto ?? 0,
    };
  }

  if (fila.modelo === "primera_hora_y_fraccion") {
    return {
      ...comun,
      modelo: "primera_hora_y_fraccion",
      valorPrimeraHora: fila.valorPrimeraHora ?? 0,
      intervaloMinutos: fila.intervaloMinutos ?? 1,
      valorIntervalo: fila.valorIntervalo ?? 0,
    };
  }

  return {
    ...comun,
    modelo: "por_intervalo",
    intervaloMinutos: fila.intervaloMinutos ?? 1,
    valorIntervalo: fila.valorIntervalo ?? 0,
  };
}

/**
 * La tarifa que regía en un instante dado, que no es necesariamente la actual.
 *
 * Es la consulta que la taquilla hará al cobrar un vehículo que entró bajo una
 * tarifa anterior. El rango se compara con `vigenteDesde <= momento` y
 * `vigenteHasta > momento` o nulo.
 */
export async function tarifaVigenteEn(
  contexto: Contexto,
  tipoVehiculoId: string,
  momento: Date,
): Promise<Tarifa | null> {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return null;

  const [fila] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select()
      .from(tarifa)
      .where(
        and(
          eq(tarifa.tipoVehiculoId, tipoVehiculoId),
          lte(tarifa.vigenteDesde, momento),
          or(isNull(tarifa.vigenteHasta), gt(tarifa.vigenteHasta, momento)),
        ),
      )
      .orderBy(desc(tarifa.vigenteDesde))
      .limit(1),
  );

  return fila ?? null;
}

/** Las tarifas vigentes ahora, con el nombre de su tipo de vehículo. */
export async function tarifasVigentes(contexto: Contexto) {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ tarifa, tipo: tipoVehiculo })
      .from(tarifa)
      .innerJoin(tipoVehiculo, eq(tipoVehiculo.id, tarifa.tipoVehiculoId))
      .where(isNull(tarifa.vigenteHasta))
      .orderBy(asc(tipoVehiculo.orden)),
  );
}

/** Historial completo de un tipo de vehículo, de lo más nuevo a lo más viejo. */
export async function historialDeTarifa(contexto: Contexto, tipoVehiculoId: string) {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select()
      .from(tarifa)
      .where(eq(tarifa.tipoVehiculoId, tipoVehiculoId))
      .orderBy(desc(tarifa.vigenteDesde)),
  );
}

/**
 * Qué tipos de vehículo todavía no tienen tarifa.
 *
 * Es lo que la pantalla usa para decir qué falta antes de operar, en vez de
 * dejar que la taquilla lo descubra con un cliente esperando.
 */
export async function tiposSinTarifa(contexto: Contexto): Promise<TipoVehiculo[]> {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return [];

  const [catalogo, conTarifa] = await Promise.all([
    comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)),
    ),
    conAmbito(contexto.parqueaderoId, (tx) =>
      tx
        .select({ id: tarifa.tipoVehiculoId })
        .from(tarifa)
        .where(isNull(tarifa.vigenteHasta)),
    ),
  ]);

  const cubiertos = new Set(conTarifa.map((t) => t.id));
  return catalogo.filter((t) => !cubiertos.has(t.id));
}

/** El catálogo completo, para las pantallas de configuración. */
export async function catalogoDeTipos(): Promise<TipoVehiculo[]> {
  return comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)),
  );
}
