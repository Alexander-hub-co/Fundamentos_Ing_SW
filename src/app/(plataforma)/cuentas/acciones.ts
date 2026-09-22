"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { bloquearCuenta, desbloquearCuenta } from "@/dominio/cuentas/bloqueo";
import { restablecerPassword } from "@/dominio/cuentas/restablecer";
import { darDeBajaCuenta } from "@/dominio/cuentas/dar-de-baja";
import { anonimizarCuenta } from "@/dominio/cuentas/anonimizar";
import {
  asignarAdministrador,
  retirarAdministrador,
} from "@/dominio/parqueaderos/asignaciones";
import type { RolDeEstablecimiento } from "@/dominio/parqueaderos/asignaciones";
import type { RolUsuario } from "@/db/esquema";

export type EstadoCuentas = { error?: string; ok?: string };

/** Traduce el formulario y deja que el dominio decida. */
export async function accionSobreCuenta(
  _previo: EstadoCuentas,
  datos: FormData,
): Promise<EstadoCuentas> {
  const contexto = await contextoActual(await headers());
  const accion = String(datos.get("accion") ?? "");
  const usuarioId = String(datos.get("usuarioId") ?? "");
  const confirmado = datos.get("confirmado") === "si";

  try {
    switch (accion) {
      case "crear":
        await crearCuenta(contexto, {
          email: String(datos.get("email") ?? ""),
          nombre: String(datos.get("nombre") ?? ""),
          passwordTemporal: String(datos.get("passwordTemporal") ?? ""),
          rol: String(datos.get("rol") ?? "operario") as RolUsuario,
          parqueaderoId: String(datos.get("parqueaderoId") ?? "") || null,
        });
        break;
      case "bloquear":
        await bloquearCuenta(contexto, { usuarioId, confirmado });
        break;
      case "desbloquear":
        await desbloquearCuenta(contexto, { usuarioId });
        break;
      case "restablecer":
        await restablecerPassword(contexto, {
          usuarioId,
          passwordTemporal: String(datos.get("passwordTemporal") ?? ""),
        });
        break;
      case "dar_de_baja":
        await darDeBajaCuenta(contexto, { usuarioId, confirmado });
        break;
      // FR-019: vincular y desvincular cuentas que YA existen. La creación ya
      // asignaba establecimiento, pero sólo en ese momento: sin estas dos, una
      // cuenta mal asignada no tenía arreglo.
      case "asignar":
        await asignarAdministrador(contexto, {
          usuarioId,
          parqueaderoId: String(datos.get("parqueaderoId") ?? ""),
          rol: String(datos.get("rol") ?? "operario") as RolDeEstablecimiento,
        });
        break;
      case "retirar":
        await retirarAdministrador(contexto, { usuarioId, confirmado });
        break;
      case "anonimizar":
        await anonimizarCuenta(contexto, { usuarioId, confirmado });
        break;
      default:
        return { error: "Acción no reconocida." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo completar" };
  }

  revalidatePath("/cuentas");
  // La ficha muestra los mismos datos: si no se revalida, quedaría mostrando el
  // estado anterior justo después de haberlo cambiado desde ella.
  if (usuarioId) revalidatePath(`/cuentas/${usuarioId}`);
  return { ok: "Listo." };
}
