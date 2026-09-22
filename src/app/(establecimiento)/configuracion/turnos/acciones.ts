"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import {
  asignarATurno,
  cambiarEstadoTurno,
  crearTurno,
  retirarDeTurno,
} from "@/dominio/turnos/gestionar";

export type EstadoTurnos = { error?: string; ok?: string };

export async function accionSobreTurnos(
  _previo: EstadoTurnos,
  datos: FormData,
): Promise<EstadoTurnos> {
  const contexto = await contextoActual(await headers());
  const accion = String(datos.get("accion") ?? "");
  const turnoId = String(datos.get("turnoId") ?? "");

  try {
    switch (accion) {
      case "crear":
        await crearTurno(contexto, {
          nombre: String(datos.get("nombre") ?? ""),
          horaInicio: String(datos.get("horaInicio") ?? ""),
          horaFin: String(datos.get("horaFin") ?? ""),
          dias: [0, 1, 2, 3, 4, 5, 6].filter((d) => datos.get(`dia-${d}`) === "si"),
        });
        break;
      case "activar":
        await cambiarEstadoTurno(contexto, turnoId, true);
        break;
      case "desactivar":
        await cambiarEstadoTurno(contexto, turnoId, false);
        break;
      case "asignar":
        await asignarATurno(contexto, turnoId, String(datos.get("usuarioId") ?? ""));
        break;
      case "retirar":
        await retirarDeTurno(contexto, turnoId, String(datos.get("usuarioId") ?? ""));
        break;
      default:
        return { error: "Acción no reconocida." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo completar" };
  }

  revalidatePath("/configuracion/turnos");
  return { ok: "Listo." };
}
