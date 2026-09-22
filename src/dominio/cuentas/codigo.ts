import { and, desc, eq, isNotNull, like, sql } from "drizzle-orm";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import type { Tx } from "@/db/ambito";
import { codigoDeCuenta, SIGLA_PLATAFORMA } from "@/dominio/parqueaderos/sigla";

/**
 * Asignación del código legible de una cuenta.
 *
 * El código sale de la sigla del establecimiento más un correlativo propio de
 * ese establecimiento: la primera cuenta de "Parqueadero Centro Histórico" es
 * `PCH-001`, la segunda `PCH-002`. Los administradores generales no pertenecen
 * a ningún local, así que se numeran bajo la sigla de la plataforma: `PQV-001`.
 *
 * SOBRE LA CONCURRENCIA. Calcular "el siguiente número" y luego insertarlo es
 * la receta clásica de la condición de carrera: dos altas simultáneas leen el
 * mismo máximo y proponen el mismo código. Hay una restricción de unicidad que
 * lo impediría, pero fallar el alta de una cuenta por una coincidencia de
 * tiempos sería un error incomprensible para quien la está creando.
 *
 * Por eso se toma un cerrojo de aviso por sigla, válido hasta el final de la
 * transacción. Serializa únicamente las altas del MISMO establecimiento —dos
 * locales distintos siguen numerando en paralelo— y se libera solo, incluso si
 * la transacción falla.
 */
export async function siguienteCodigoDeCuenta(
  tx: Tx,
  parqueaderoId: string | null,
): Promise<string> {
  const sigla = await siglaPara(tx, parqueaderoId);

  // Cerrojo por sigla. `hashtext` la reduce al entero que pide la función; que
  // dos siglas distintas colisionen en el hash sólo costaría serializar de más,
  // nunca corrección.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${sigla}))`);

  const [ultima] = await tx
    .select({ codigo: usuario.codigo })
    .from(usuario)
    .where(and(isNotNull(usuario.codigo), like(usuario.codigo, `${sigla}-%`)))
    .orderBy(desc(sql`length(${usuario.codigo})`), desc(usuario.codigo))
    .limit(1);

  return codigoDeCuenta(sigla, numeroDe(ultima?.codigo ?? null) + 1);
}

/**
 * Sigla bajo la que numerar: la del establecimiento, o la de la plataforma si
 * la cuenta no pertenece a ninguno.
 */
async function siglaPara(tx: Tx, parqueaderoId: string | null): Promise<string> {
  if (!parqueaderoId) return SIGLA_PLATAFORMA;

  const [establecimiento] = await tx
    .select({ codigo: parqueadero.codigo })
    .from(parqueadero)
    .where(eq(parqueadero.id, parqueaderoId))
    .limit(1);

  return establecimiento?.codigo ?? SIGLA_PLATAFORMA;
}

/**
 * Extrae el correlativo de un código ya asignado.
 *
 * El orden de la consulta es por longitud y después alfabético, no sólo
 * alfabético: con más de 999 cuentas aparece `PCH-1000`, que alfabéticamente
 * queda ANTES de `PCH-999` y haría repetir números.
 */
function numeroDe(codigo: string | null): number {
  if (!codigo) return 0;
  const partes = codigo.split("-");
  const numero = Number.parseInt(partes[partes.length - 1] ?? "", 10);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Código de la cuenta a partir de su asignación, para rellenar las que se
 * crearon antes de que este esquema existiera.
 */
export async function parqueaderoDeCuenta(
  tx: Tx,
  usuarioId: string,
): Promise<string | null> {
  const [fila] = await tx
    .select({ parqueaderoId: asignacion.parqueaderoId })
    .from(asignacion)
    .where(eq(asignacion.usuarioId, usuarioId))
    .limit(1);

  return fila?.parqueaderoId ?? null;
}
