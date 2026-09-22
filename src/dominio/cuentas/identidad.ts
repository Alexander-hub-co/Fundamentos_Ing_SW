import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { usuario } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

const ROL_VISIBLE: Record<string, string> = {
  admin_general: "Administrador general",
  admin_parqueadero: "Administrador del parqueadero",
  operario: "Operario de taquilla",
};

/**
 * Quién está usando el sistema, para mostrarlo al pie de la barra lateral.
 *
 * No va en el contexto de sesión a propósito. Ese contexto lo resuelve cada
 * petición y lo consultan todas las operaciones de dominio; agregarle el nombre
 * obligaría a leerlo siempre para usarlo sólo en la barra. Acá se pide una vez
 * por pantalla y sólo donde se muestra.
 *
 * Se lee con privilegio de plataforma porque la tabla de cuentas es de
 * plataforma —la autenticación ocurre antes de que exista ámbito—, y se acota a
 * la propia cuenta de quien pregunta.
 */
export async function identidadVisible(
  contexto: Contexto,
): Promise<{ nombre: string; rol: string }> {
  const [fila] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select({ nombre: usuario.name })
      .from(usuario)
      .where(eq(usuario.id, contexto.usuarioId))
      .limit(1),
  );

  return {
    nombre: fila?.nombre ?? "Cuenta sin nombre",
    rol: ROL_VISIBLE[contexto.rol] ?? contexto.rol,
  };
}
