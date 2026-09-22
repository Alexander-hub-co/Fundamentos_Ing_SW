"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { editarMiParqueadero } from "@/dominio/parqueaderos/editar";
import { contextoActual } from "@/lib/sesion";
import type { EstadoEdicion } from "@/app/campos-establecimiento";

/**
 * Edición del propio establecimiento (FR-022).
 *
 * No recibe identificador y no debe recibirlo: el ámbito sale de la sesión y la
 * política RLS acota el UPDATE por sí sola. Un parámetro que no existe no se
 * puede manipular para editar el establecimiento de otro.
 */
export async function guardarMiEstablecimiento(
  _previo: EstadoEdicion,
  datos: FormData,
): Promise<EstadoEdicion> {
  const contexto = await contextoActual(await headers());

  try {
    await editarMiParqueadero(contexto, {
      nombre: String(datos.get("nombre") ?? ""),
      ciudad: String(datos.get("ciudad") ?? "") || null,
      direccion: String(datos.get("direccion") ?? "") || null,
      telefono: String(datos.get("telefono") ?? "") || null,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar",
    };
  }

  revalidatePath("/establecimiento");
  redirect("/establecimiento");
}
