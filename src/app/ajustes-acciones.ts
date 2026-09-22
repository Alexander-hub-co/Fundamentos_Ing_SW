"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import { fijarApariencia } from "@/lib/apariencia";
import { esAcento, esAnchoRollo, esDensidad, esTema } from "@/dominio/preferencias/valores";
import {
  guardarPreferencias,
  PLACA_MAXIMA,
  PLACA_MINIMA,
} from "@/dominio/preferencias/gestionar";

export type EstadoAjustes = { error?: string; ok?: string };

/**
 * Guarda los ajustes y deja la apariencia puesta en el navegador.
 *
 * Los dos pasos van juntos y en este orden a propósito: la base de datos es la
 * preferencia duradera de la cuenta y la cookie es sólo el transporte con el
 * que se pinta el HTML. Si el guardado falla no se toca la cookie, para que lo
 * que se ve siga coincidiendo con lo que está guardado.
 */
export async function guardarAjustes(
  _previo: EstadoAjustes,
  datos: FormData,
): Promise<EstadoAjustes> {
  const contexto = await contextoActual(await headers());

  const tema = datos.get("tema");
  const acento = datos.get("acento");
  const densidad = datos.get("densidad");

  if (!esTema(tema) || !esAcento(acento)) {
    return { error: "La apariencia elegida no es válida." };
  }
  if (!esDensidad(densidad)) {
    return { error: "La densidad elegida no es válida." };
  }

  const tamanoPlaca = Number(datos.get("tamanoPlaca"));
  if (!Number.isInteger(tamanoPlaca) || tamanoPlaca < PLACA_MINIMA || tamanoPlaca > PLACA_MAXIMA) {
    return {
      error: `El tamaño de la placa debe estar entre ${PLACA_MINIMA} y ${PLACA_MAXIMA} píxeles.`,
    };
  }

  const anchoRollo = Number(datos.get("anchoRollo"));
  if (!esAnchoRollo(anchoRollo)) {
    return { error: "El rollo sólo puede ser de 58 u 80 milímetros." };
  }

  try {
    await guardarPreferencias(contexto, {
      tema,
      acento,
      densidad,
      tamanoPlaca,
      confirmarCobro: datos.get("confirmarCobro") === "si",
      imprimirAuto: datos.get("imprimirAuto") === "si",
      anchoRollo,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron guardar los ajustes" };
  }

  await fijarApariencia(tema, acento);

  // El tema y el acento viven en el elemento raíz, así que se revalida todo.
  revalidatePath("/", "layout");
  return { ok: "Ajustes guardados." };
}
