import { and, eq, isNotNull, sql } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { movimiento } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/**
 * Cuántas veces se aplicó ya cada convenio hoy a esta placa.
 *
 * Es EL número que faltaba. Cuando se especificaron los convenios se decidió
 * que el cálculo lo recibiera como dato en vez de averiguarlo, para poder
 * declarar y probar la regla del límite diario sin que existiera historial de
 * movimientos. Aquél era el hueco; ésta es la pieza que lo llena.
 *
 * Se cuenta contra el DÍA DE LA SALIDA, en la zona del establecimiento, porque
 * es el instante en que el convenio se aplica y se cobra. Un carro que entró el
 * martes a las once de la noche y salió el miércoles a las dos gasta el cupo del
 * miércoles.
 *
 * Se lee del desglose guardado en cada movimiento cerrado y no de una tabla de
 * contadores aparte: el desglose ya dice qué convenios se aplicaron de verdad,
 * y un contador separado podría discrepar de él sin que nada avisara.
 */
export async function aplicacionesPreviasHoy(
  contexto: Contexto,
  /**
   * Nula en las bicicletas, que no tienen placa.
   *
   * El límite diario de un convenio cuenta cuántas veces se le aplicó A ESA
   * PLACA hoy. Sin placa no hay a qué contarle, así que devuelve vacío: es lo
   * correcto y no un caso sin resolver. Los convenios que se activan por placa
   * simplemente no alcanzan a las bicicletas, y los de sello no dependen del
   * vehículo sino de lo que el cliente trae en la mano.
   */
  placa: string | null,
  dia: string,
  convenioIds: string[],
): Promise<Map<string, number>> {
  const cuenta = new Map<string, number>();
  if (contexto.tipo !== "establecimiento" || convenioIds.length === 0) return cuenta;
  if (placa === null) return cuenta;

  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ cobro: movimiento.cobro })
      .from(movimiento)
      .where(
        and(
          eq(movimiento.placa, placa),
          isNotNull(movimiento.salidaEn),
          isNotNull(movimiento.cobro),
          // El día calendario del establecimiento, no el del servidor. Sin la
          // zona, una salida de las nueve de la noche contaría en el día
          // siguiente.
          sql`(${movimiento.salidaEn} at time zone 'America/Bogota')::date = ${dia}::date`,
        ),
      ),
  );

  const interesan = new Set(convenioIds);

  for (const fila of filas) {
    const beneficios = (fila.cobro as { beneficios?: { convenioId: string; noAplicado?: string }[] } | null)
      ?.beneficios;
    if (!beneficios) continue;

    for (const b of beneficios) {
      // Sólo cuenta lo que de verdad se aplicó. Un convenio descartado por su
      // propio límite no consumió cupo, y contarlo lo dejaría bloqueado para
      // siempre.
      if (b.noAplicado || !interesan.has(b.convenioId)) continue;
      cuenta.set(b.convenioId, (cuenta.get(b.convenioId) ?? 0) + 1);
    }
  }

  return cuenta;
}
