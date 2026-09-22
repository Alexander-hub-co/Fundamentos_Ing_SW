"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import { declararHorario } from "@/dominio/horarios/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";

export type EstadoHorario = { error?: string; ok?: string };

/** Guarda el horario completo. Las franjas llegan como campos por día. */
export async function guardarHorario(
  _previo: EstadoHorario,
  datos: FormData,
): Promise<EstadoHorario> {
  const contexto = await contextoActual(await headers());
  const abierto24h = datos.get("abierto24h") === "si";

  const franjas = [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => datos.get(`abre-${d}`) === "si")
    .map((d) => ({
      diaSemana: d,
      horaApertura: String(datos.get(`apertura-${d}`) ?? ""),
      horaCierre: String(datos.get(`cierre-${d}`) ?? ""),
    }))
    .filter((f) => f.horaApertura !== "" && f.horaCierre !== "");

  try {
    await declararHorario(contexto, {
      abierto24h,
      cobraHorasCerradas: datos.get("cobraHorasCerradas") === "si",
      franjas,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar" };
  }

  revalidatePath("/configuracion/horario");
  return { ok: "Horario guardado." };
}

export async function guardarCapacidad(
  _previo: EstadoHorario,
  datos: FormData,
): Promise<EstadoHorario> {
  const contexto = await contextoActual(await headers());

  try {
    await declararCapacidad(
      contexto,
      String(datos.get("tipoVehiculoId") ?? ""),
      Number.parseInt(String(datos.get("cupos") ?? "0"), 10),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar" };
  }

  revalidatePath("/configuracion/horario");
  return { ok: "Capacidad guardada." };
}
