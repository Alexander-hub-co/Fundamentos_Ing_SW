"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { contextoActual } from "@/lib/sesion";

export type EstadoAlta = { error?: string };

export async function altaParqueadero(
  _previo: EstadoAlta,
  datos: FormData,
): Promise<EstadoAlta> {
  const contexto = await contextoActual(await headers());

  try {
    // La autorización la exige `crearParqueadero` por su cuenta. No se confía
    // en que esta acción sólo sea alcanzable desde el panel correcto.
    await crearParqueadero(contexto, {
      nombre: String(datos.get("nombre") ?? ""),
      ciudad: String(datos.get("ciudad") ?? "") || null,
      direccion: String(datos.get("direccion") ?? "") || null,
      telefono: String(datos.get("telefono") ?? "") || null,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo crear el establecimiento",
    };
  }

  revalidatePath("/parqueaderos");
  redirect("/parqueaderos");
}
