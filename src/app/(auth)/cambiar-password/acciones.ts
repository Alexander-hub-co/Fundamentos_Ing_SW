"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { cambiarPasswordObligatorio, PasswordDebil } from "@/dominio/autenticacion/cambio-obligatorio";

export type EstadoCambio = { error?: string };

export async function cambiarPassword(
  _previo: EstadoCambio,
  datos: FormData,
): Promise<EstadoCambio> {
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion) redirect("/login");

  const nueva = String(datos.get("password") ?? "");
  const repetida = String(datos.get("repetir") ?? "");

  if (nueva !== repetida) return { error: "Las dos contraseñas no coinciden." };

  try {
    await cambiarPasswordObligatorio({ usuarioId: sesion.user.id, nuevaPassword: nueva });
  } catch (error) {
    if (error instanceof PasswordDebil) return { error: error.message };
    throw error;
  }

  // El contexto ya no lanzará DebeCambiarPassword, así que el destino se
  // resuelve normalmente en la portada de cada rol.
  redirect("/");
}
