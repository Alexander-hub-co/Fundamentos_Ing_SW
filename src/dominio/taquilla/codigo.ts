import { and, desc, eq, like, sql } from "drizzle-orm";
import { movimiento, parqueadero } from "@/db/esquema";
import type { Tx } from "@/db/ambito";

/**
 * El código legible de un movimiento: `PCA-000147`.
 *
 * Va en el comprobante, y por eso es legible y no un identificador aleatorio:
 * alguien va a tener que leerlo en voz alta por teléfono o escribirlo a mano
 * cuando el papel térmico se borre. Y se borra: es lo que hace el papel térmico.
 *
 * Seis dígitos y no tres como en las cuentas, porque un parqueadero mediano
 * pasa el millar en semanas.
 *
 * SOBRE LA CONCURRENCIA. Aquí sí hace falta el cerrojo de aviso, a diferencia
 * de la garantía de "una placa adentro una sola vez", que la impone un índice.
 * La diferencia es que un correlativo obliga a LEER el último y escribir el
 * siguiente, y entre lo uno y lo otro cabe otra transacción; la placa no hay
 * que leerla, se intenta insertar y el motor acepta o rechaza.
 */
export async function siguienteCodigoDeMovimiento(
  tx: Tx,
  parqueaderoId: string,
): Promise<string> {
  const [establecimiento] = await tx
    .select({ codigo: parqueadero.codigo })
    .from(parqueadero)
    .where(eq(parqueadero.id, parqueaderoId))
    .limit(1);

  const sigla = establecimiento?.codigo ?? "PQV";

  // Serializa sólo los movimientos de ESTE establecimiento; dos locales
  // distintos siguen numerando en paralelo. Se libera al terminar la
  // transacción, incluso si falla.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`mov:${sigla}`}))`);

  const [ultimo] = await tx
    .select({ codigo: movimiento.codigo })
    .from(movimiento)
    .where(and(eq(movimiento.parqueaderoId, parqueaderoId), like(movimiento.codigo, `${sigla}-%`)))
    // Por longitud y después alfabético: con seis dígitos fijos daría igual,
    // pero el día que alguien pase el millón `PCA-1000000` quedaría antes de
    // `PCA-999999` en orden alfabético y se repetirían números.
    .orderBy(desc(sql`length(${movimiento.codigo})`), desc(movimiento.codigo))
    .limit(1);

  const numero = Number.parseInt(ultimo?.codigo?.split("-").at(-1) ?? "", 10);
  return `${sigla}-${String((Number.isFinite(numero) ? numero : 0) + 1).padStart(6, "0")}`;
}
