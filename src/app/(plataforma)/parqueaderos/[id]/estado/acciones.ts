"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoActual } from "@/lib/sesion";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { darDeBajaParqueadero } from "@/dominio/parqueaderos/baja";
import type { EstadoParqueadero } from "@/db/esquema";

export type EstadoAccion = { error?: string; ok?: string };

const ESTADOS_VALIDOS: EstadoParqueadero[] = [
  "activo",
  "pendiente",
  "suspendido",
  "dado_de_baja",
];

export async function cambiarEstado(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const contexto = await contextoActual(await headers());

  const parqueaderoId = String(datos.get("parqueaderoId") ?? "");
  const nuevoEstado = String(datos.get("nuevoEstado") ?? "");
  const motivo = String(datos.get("motivo") ?? "");
  const confirmado = datos.get("confirmado") === "si";

  if (!ESTADOS_VALIDOS.includes(nuevoEstado as EstadoParqueadero)) {
    return { error: "Estado no válido." };
  }

  try {
    // La autorización y la validez de la transición las exige el dominio: esta
    // acción no decide nada, sólo traduce el formulario.
    if (nuevoEstado === "dado_de_baja") {
      await darDeBajaParqueadero(contexto, { parqueaderoId, motivo, confirmado });
    } else {
      await cambiarEstadoParqueadero(contexto, {
        parqueaderoId,
        nuevoEstado: nuevoEstado as EstadoParqueadero,
        motivo,
      });
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo cambiar el estado",
    };
  }

  revalidatePath(`/parqueaderos/${parqueaderoId}/estado`);
  revalidatePath("/parqueaderos");
  redirect("/parqueaderos");
}
