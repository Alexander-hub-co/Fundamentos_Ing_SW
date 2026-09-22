import { cookies } from "next/headers";
import { esAcento, esTema } from "@/dominio/preferencias/valores";
import type { AcentoVisual, TemaVisual } from "@/dominio/preferencias/valores";

/**
 * La apariencia con la que se pinta el HTML.
 *
 * Se activa ÚNICAMENTE por elección de la persona. Deliberadamente NO se
 * consulta `prefers-color-scheme`: el sistema operativo no decide por el
 * usuario, porque alguien puede tener su equipo en oscuro y aun así preferir
 * Parquivo en claro.
 *
 * **Dos sitios y no uno, a propósito.** La preferencia DURADERA vive en la base
 * de datos y es de la cuenta (`dominio/preferencias`), como pide el handoff: un
 * operario puede trabajar en oscuro aunque su administrador use el claro, y lo
 * conserva al cambiar de equipo. Pero el elemento raíz se pinta antes de que
 * exista sesión —el login también tiene tema—, y resolver la cuenta en cada
 * petición sólo para saber el color sería caro. Así que la cookie es el
 * TRANSPORTE: se escribe al guardar los ajustes y al iniciar sesión, y es lo
 * único que el diseño consulta para pintar.
 *
 * La cookie, y no `localStorage`, porque el servidor necesita conocer la
 * apariencia para mandar el HTML ya con los atributos puestos. Con
 * `localStorage` la página llegaría en claro y saltaría a oscuro al ejecutarse
 * el script: el parpadeo blanco que se ve en tantos sitios.
 */

export const COOKIE_TEMA = "parquivo-tema";
export const COOKIE_ACENTO = "parquivo-acento";

export type Tema = TemaVisual;
export type Acento = AcentoVisual;

/**
 * Con qué se ve Parquivo antes de que la persona elija.
 *
 * Oscuro desde el rediseño: las pantallas están dibujadas sobre fondo oscuro, y
 * la taquilla se atiende muchas horas seguidas, a menudo de noche y con poca
 * luz. Verde porque es el color con el que el logo marca lo que importa.
 *
 * Es sólo el punto de partida; la elección se hace en Ajustes.
 */
export const TEMA_POR_DEFECTO: Tema = "oscuro";
export const ACENTO_POR_DEFECTO: Acento = "verde";

/** Lo elegido, o el punto de partida si nunca se eligió. */
export async function aparienciaActual(): Promise<{ tema: Tema; acento: Acento }> {
  const galleta = await cookies();
  const tema = galleta.get(COOKIE_TEMA)?.value;
  const acento = galleta.get(COOKIE_ACENTO)?.value;

  return {
    tema: esTema(tema) ? tema : TEMA_POR_DEFECTO,
    acento: esAcento(acento) ? acento : ACENTO_POR_DEFECTO,
  };
}

/** Sólo el tema, para quien no necesita el resto. */
export async function temaActual(): Promise<Tema> {
  return (await aparienciaActual()).tema;
}

const UN_ANIO = 60 * 60 * 24 * 365;

/**
 * Deja la apariencia puesta en el navegador.
 *
 * No es `httpOnly`: no lleva datos sensibles, y sí debe viajar en cada petición
 * para que el servidor pinte el HTML ya con los atributos.
 */
export async function fijarApariencia(tema: Tema, acento: Acento): Promise<void> {
  const galleta = await cookies();
  const opciones = { maxAge: UN_ANIO, sameSite: "lax", path: "/", httpOnly: false } as const;

  galleta.set(COOKIE_TEMA, tema, opciones);
  galleta.set(COOKIE_ACENTO, acento, opciones);
}
