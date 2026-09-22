"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import {
  cambiarRolEnMiEstablecimiento,
  crearCuentaEnMiEstablecimiento,
  gestionarCuentaDeMiEstablecimiento,
  type AccionSobreCuentaPropia,
} from "@/dominio/cuentas/en-establecimiento";
import type { RolUsuario } from "@/db/esquema";
import { otorgarDelegacion, revocarDelegacion } from "@/dominio/correcciones/emitir";

export type EstadoEquipo = { error?: string; ok?: string };

/**
 * Alta y gestión del equipo, en una sola acción.
 *
 * El establecimiento NO viaja en el formulario: sale de la sesión. Un dato que
 * no se recibe no se puede manipular para tocar la gente de otro local.
 */
export async function accionSobreEquipo(
  _previo: EstadoEquipo,
  datos: FormData,
): Promise<EstadoEquipo> {
  const contexto = await contextoActual(await headers());
  const accion = String(datos.get("accion") ?? "");
  const usuarioId = String(datos.get("usuarioId") ?? "");

  try {
    switch (accion) {
      case "crear":
        await crearCuentaEnMiEstablecimiento(contexto, {
          email: String(datos.get("email") ?? ""),
          nombre: String(datos.get("nombre") ?? ""),
          passwordTemporal: String(datos.get("passwordTemporal") ?? ""),
          rol: String(datos.get("rol") ?? "operario") as Exclude<RolUsuario, "admin_general">,
        });
        break;
      case "cambiar_rol":
        await cambiarRolEnMiEstablecimiento(
          contexto,
          usuarioId,
          String(datos.get("rol") ?? "operario") as Exclude<RolUsuario, "admin_general">,
        );
        break;
      case "bloquear":
      case "desbloquear":
      case "dar_de_baja":
        await gestionarCuentaDeMiEstablecimiento(
          contexto,
          accion as AccionSobreCuentaPropia,
          { usuarioId },
        );
        break;
      case "delegar_correccion":
        await otorgarDelegacion(contexto, usuarioId, "emitir_correccion");
        break;
      case "revocar_correccion":
        await revocarDelegacion(contexto, usuarioId, "emitir_correccion");
        break;
      case "restablecer":
        await gestionarCuentaDeMiEstablecimiento(contexto, "restablecer", {
          usuarioId,
          passwordTemporal: String(datos.get("passwordTemporal") ?? ""),
        });
        break;
      default:
        return { error: "Acción no reconocida." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo completar" };
  }

  revalidatePath("/equipo");
  return { ok: "Listo." };
}