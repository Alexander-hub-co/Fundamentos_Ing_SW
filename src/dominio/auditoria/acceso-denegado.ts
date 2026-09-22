import { desc } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { accesoDenegado, usoPrivilegio } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";
import { RecursoNoAlcanzable } from "@/lib/errores";

/**
 * Registro de auditoría de la frontera de aislamiento.
 *
 * Dos cosas distintas se anotan acá, y conviene no confundirlas:
 *
 *   - Un acceso DENEGADO por violación de ámbito (FR-005). Es una señal de
 *     alarma: alguien pidió algo que no le corresponde.
 *   - Un ejercicio del privilegio global, que es legítimo pero debe quedar
 *     visible (escenario 4 de la historia 2).
 */

/**
 * Punto ÚNICO de denegación por ámbito (FR-005).
 *
 * Devuelve el error en vez de lanzarlo para que quien llama escriba
 * `throw await errorDeAlcance(...)`: con el `throw` a la vista, TypeScript
 * sigue entendiendo que después de esa línea no se ejecuta nada, cosa que
 * perdería si la función lanzara por dentro.
 *
 * El registro se escribe por una conexión distinta de la transacción en curso,
 * y es deliberado: casi siempre la denegación ocurre dentro de una transacción
 * que va a deshacerse justo después: si el asiento compartiera esa transacción,
 * desaparecería con ella y el intento no dejaría rastro, que es exactamente lo
 * contrario de lo que pide el requisito.
 */
export async function errorDeAlcance(
  contexto: Contexto | null,
  recurso: string,
): Promise<RecursoNoAlcanzable> {
  await registrarAccesoDenegado({
    usuarioId: contexto?.usuarioId ?? null,
    recurso,
    parqueaderoAmbito:
      contexto?.tipo === "establecimiento" ? contexto.parqueaderoId : null,
  });

  return new RecursoNoAlcanzable(recurso);
}

/**
 * Anota un intento de operar fuera de ámbito.
 *
 * Nunca lanza: un fallo al auditar no debe convertirse en un fallo de la
 * petición, porque el usuario ya recibió su denegación y perder el registro es
 * menos grave que perder la denegación.
 */
export async function registrarAccesoDenegado(datos: {
  usuarioId?: string | null;
  recurso: string;
  parqueaderoAmbito?: string | null;
}): Promise<void> {
  try {
    await comoPlataforma("administracion_plataforma", (tx) =>
      tx.insert(accesoDenegado).values({
        usuarioId: datos.usuarioId ?? null,
        recurso: datos.recurso,
        parqueaderoAmbito: datos.parqueaderoAmbito ?? null,
      }),
    );
  } catch (error) {
    console.error("[auditoría] no se pudo registrar el acceso denegado", error);
  }
}

/**
 * Anota el ejercicio del privilegio global.
 *
 * Se registra la operación concreta y quién la ejecutó, no un motivo genérico:
 * un asiento que dice "alguien usó el privilegio" no sirve para auditar nada.
 *
 * Sólo se anotan las operaciones de administración. La autenticación también
 * atraviesa el aislamiento, pero ocurre en cada petición y su registro
 * ahogaría la señal útil bajo el ruido.
 */
export async function registrarUsoPrivilegio(
  contexto: Contexto,
  operacion: string,
): Promise<void> {
  try {
    await comoPlataforma("administracion_plataforma", (tx) =>
      tx.insert(usoPrivilegio).values({
        usuarioId: contexto.usuarioId,
        operacion,
      }),
    );
  } catch (error) {
    console.error("[auditoría] no se pudo registrar el uso del privilegio", error);
  }
}

/** Consulta de auditoría, para el panel del administrador general. */
export const ACCESOS_DENEGADOS_POR_PAGINA = 50;

export async function ultimosAccesosDenegados(
  limite = ACCESOS_DENEGADOS_POR_PAGINA,
) {
  return comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select()
      .from(accesoDenegado)
      .orderBy(desc(accesoDenegado.ocurridoEn))
      .limit(limite),
  );
}
