"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { tarifaVigenteEn } from "@/dominio/tarifas/consultar";
import { aTarifaAplicable } from "@/dominio/tarifas/consultar";
import { calcularImporte } from "@/dominio/tarifas/calcular";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import type { AlcancePlena, ModeloCobro } from "@/db/esquema";
import type { Cobro } from "@/dominio/tarifas/modelos";

export type EstadoTarifa = { error?: string; ok?: string };

const entero = (datos: FormData, campo: string): number | null => {
  const bruto = String(datos.get(campo) ?? "").trim();
  if (bruto === "") return null;
  const n = Number.parseInt(bruto, 10);
  return Number.isFinite(n) ? n : null;
};

/** Declara la tarifa vigente de un tipo de vehículo. */
export async function guardarTarifa(
  _previo: EstadoTarifa,
  datos: FormData,
): Promise<EstadoTarifa> {
  const contexto = await contextoActual(await headers());
  const modelo = String(datos.get("modelo") ?? "por_minuto") as ModeloCobro;

  try {
    await declararTarifa(contexto, {
      tipoVehiculoId: String(datos.get("tipoVehiculoId") ?? ""),
      modelo,
      alcancePlena: String(datos.get("alcancePlena") ?? "jornada") as AlcancePlena,
      tarifaPlena: entero(datos, "tarifaPlena") ?? 0,
      // Sólo se envían los del modelo elegido: los del otro se dejan nulos, que
      // es lo que el CHECK de la tabla exige.
      tarifaMinima: modelo === "por_minuto" ? entero(datos, "tarifaMinima") : null,
      valorMinuto: modelo === "por_minuto" ? entero(datos, "valorMinuto") : null,
      // El bloque lo comparten dos modelos; el valor de la primera hora es de
      // uno solo. Los que no corresponden van nulos, que es lo que el CHECK de
      // la tabla exige.
      intervaloMinutos: modelo === "por_minuto" ? null : entero(datos, "intervaloMinutos"),
      valorIntervalo: modelo === "por_minuto" ? null : entero(datos, "valorIntervalo"),
      valorPrimeraHora:
        modelo === "primera_hora_y_fraccion" ? entero(datos, "valorPrimeraHora") : null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar" };
  }

  revalidatePath("/configuracion/tarifas");
  return { ok: "Tarifa guardada." };
}

export type EstadoProbador = { error?: string; cobro?: Cobro };

/**
 * Prueba el cálculo con dos instantes de ejemplo.
 *
 * Existe para que el administrador compruebe su tarifa antes de que llegue el
 * primer cliente, en vez de descubrir en la taquilla que cobra de más.
 */
export async function probarCalculo(
  _previo: EstadoProbador,
  datos: FormData,
): Promise<EstadoProbador> {
  const contexto = await contextoActual(await headers());

  const entrada = new Date(String(datos.get("entrada") ?? ""));
  const salida = new Date(String(datos.get("salida") ?? ""));

  if (Number.isNaN(entrada.getTime()) || Number.isNaN(salida.getTime())) {
    return { error: "Escriba una fecha y hora de entrada y de salida" };
  }
  if (salida <= entrada) {
    return { error: "La salida debe ser posterior a la entrada" };
  }

  const fila = await tarifaVigenteEn(
    contexto,
    String(datos.get("tipoVehiculoId") ?? ""),
    entrada,
  );
  if (!fila) return { error: "Ese tipo de vehículo no tenía tarifa vigente en ese momento" };

  return {
    cobro: calcularImporte({
      entrada,
      salida,
      tarifa: aTarifaAplicable(fila),
      horario: await horarioDelCobro(contexto),
    }),
  };
}
