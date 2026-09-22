import { conAmbito } from "@/db/ambito";
import { politicaCobro, type ReglaRedondeo } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { REDONDEO_INICIAL } from "./redondeo";

/**
 * La política de cobro del establecimiento.
 *
 * Vive aparte de `redondeo.ts` a propósito: aquéllas son funciones puras y
 * éstas tocan la base. Mezclarlas rompería la prueba de pureza, y con razón.
 */

/**
 * Cómo redondea este establecimiento.
 *
 * Sin fila declarada devuelve el valor inicial, igual que un establecimiento
 * sin horario se trata como abierto veinticuatro horas. Resolver la ausencia
 * acá, una sola vez, evita que la rama "¿y si falta?" se reparta por el resto
 * del código.
 */
export async function politicaDeCobro(contexto: Contexto): Promise<ReglaRedondeo> {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return REDONDEO_INICIAL;

  const [fila] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.select({ redondeo: politicaCobro.redondeo }).from(politicaCobro).limit(1),
  );

  return fila?.redondeo ?? REDONDEO_INICIAL;
}

/** Declara la regla de redondeo. Crea la fila la primera vez y la actualiza después. */
export async function fijarRedondeo(contexto: Contexto, regla: ReglaRedondeo): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  if (contexto.tipo !== "establecimiento") return;

  const parqueaderoId = contexto.parqueaderoId;

  await conAmbito(parqueaderoId, (tx) =>
    tx
      .insert(politicaCobro)
      .values({ parqueaderoId, redondeo: regla })
      // La columna es única por establecimiento, así que el segundo cambio
      // actualiza en vez de fallar. Sin esto habría que consultar antes de
      // escribir, y entre la consulta y la escritura cabe otra petición.
      .onConflictDoUpdate({
        target: politicaCobro.parqueaderoId,
        set: { redondeo: regla, actualizadoEn: new Date() },
      }),
  );
}
