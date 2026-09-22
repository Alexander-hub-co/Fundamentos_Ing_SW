"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { editarParqueadero } from "@/dominio/parqueaderos/editar";
import { contextoActual } from "@/lib/sesion";
import type { EstadoEdicion } from "@/app/campos-establecimiento";

/**
 * Edición de cualquier establecimiento por el administrador general (FR-018).
 *
 * El identificador viaja en el formulario y no se comprueba acá: la
 * autorización la exige `editarParqueadero` por su cuenta, y quien no sea
 * administrador general no pasa de ahí aunque alcance esta acción.
 */
export async function guardarEstablecimiento(
  _previo: EstadoEdicion,
  datos: FormData,
): Promise<EstadoEdicion> {
  const contexto = await contextoActual(await headers());
  const id = String(datos.get("id") ?? "");

  try {
    await editarParqueadero(contexto, id, {
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

  revalidatePath("/parqueaderos");
  revalidatePath(`/parqueaderos/${id}`);
  redirect(`/parqueaderos/${id}`);
}
