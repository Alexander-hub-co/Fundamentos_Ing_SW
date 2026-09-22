import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { preferenciaUsuario } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";
import { esAnchoRollo, PLACA_MAXIMA, PLACA_MINIMA, PREFERENCIAS_POR_DEFECTO } from "./valores";
import type { Preferencias } from "./valores";

/**
 * Cómo quiere ver Parquivo cada persona.
 *
 * Se lee con privilegio de plataforma porque la tabla es de plataforma —la
 * preferencia es de la cuenta, no del parqueadero— y se acota siempre a la
 * propia cuenta de quien pregunta. Es el mismo trato que `identidadVisible`,
 * por la misma razón: no hay ámbito de tenencia al que colgarlo.
 *
 * No hace falta `exigir`: nadie necesita permiso para elegir de qué color ve su
 * propia pantalla, y la operación no alcanza ninguna cuenta ajena. Lo que sí
 * hay que sostener es que el identificador venga del contexto de sesión y no de
 * un parámetro; por eso ninguna de estas funciones recibe un usuarioId.
 *
 * El vocabulario y los valores de fábrica viven en `valores.ts`, que no importa
 * nada de la base y por eso puede usarlo también el formulario de cliente.
 */
export { ANCHOS_ROLLO, PLACA_MAXIMA, PLACA_MINIMA, PREFERENCIAS_POR_DEFECTO } from "./valores";
export type { AnchoRollo, Preferencias } from "./valores";

export class PreferenciaInvalida extends Error {}

export async function preferenciasDe(contexto: Contexto): Promise<Preferencias> {
  const [fila] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select()
      .from(preferenciaUsuario)
      .where(eq(preferenciaUsuario.usuarioId, contexto.usuarioId))
      .limit(1),
  );

  if (!fila) return PREFERENCIAS_POR_DEFECTO;

  return {
    tema: fila.tema,
    acento: fila.acento,
    densidad: fila.densidad,
    tamanoPlaca: fila.tamanoPlaca,
    confirmarCobro: fila.confirmarCobro,
    imprimirAuto: fila.imprimirAuto,
    anchoRollo: esAnchoRollo(fila.anchoRollo) ? fila.anchoRollo : PREFERENCIAS_POR_DEFECTO.anchoRollo,
  };
}

/**
 * Guarda lo elegido.
 *
 * Cuando lo elegido coincide exactamente con el punto de partida se BORRA la
 * fila en vez de escribirla. No es una optimización: es lo que hace que
 * "restablecer" signifique de verdad volver al punto de partida. Si se guardara
 * una fila con los valores de hoy, el día que el punto de partida cambie esa
 * cuenta se quedaría congelada en el anterior sin haberlo pedido nunca.
 */
export async function guardarPreferencias(
  contexto: Contexto,
  datos: Preferencias,
): Promise<Preferencias> {
  validar(datos);

  await comoPlataforma("administracion_plataforma", (tx) => {
    if (sonLasDeFabrica(datos)) {
      return tx
        .delete(preferenciaUsuario)
        .where(eq(preferenciaUsuario.usuarioId, contexto.usuarioId));
    }

    return tx
      .insert(preferenciaUsuario)
      .values({ usuarioId: contexto.usuarioId, ...datos })
      .onConflictDoUpdate({
        target: preferenciaUsuario.usuarioId,
        set: { ...datos, actualizadoEn: new Date() },
      });
  });

  return datos;
}

function sonLasDeFabrica(datos: Preferencias): boolean {
  const f = PREFERENCIAS_POR_DEFECTO;
  return (
    datos.tema === f.tema &&
    datos.acento === f.acento &&
    datos.densidad === f.densidad &&
    datos.tamanoPlaca === f.tamanoPlaca &&
    datos.confirmarCobro === f.confirmarCobro &&
    datos.imprimirAuto === f.imprimirAuto &&
    datos.anchoRollo === f.anchoRollo
  );
}

function validar(datos: Preferencias): void {
  if (!Number.isInteger(datos.tamanoPlaca)) {
    throw new PreferenciaInvalida("El tamaño de la placa debe ser un número entero de píxeles");
  }

  if (datos.tamanoPlaca < PLACA_MINIMA || datos.tamanoPlaca > PLACA_MAXIMA) {
    throw new PreferenciaInvalida(
      `El tamaño de la placa debe estar entre ${PLACA_MINIMA} y ${PLACA_MAXIMA} píxeles`,
    );
  }

  if (!esAnchoRollo(datos.anchoRollo)) {
    throw new PreferenciaInvalida("El rollo sólo puede ser de 58 u 80 milímetros");
  }
}
