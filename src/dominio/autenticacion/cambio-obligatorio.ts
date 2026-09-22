import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { usuario } from "@/db/esquema";
import { fijarPassword } from "@/dominio/autenticacion/password";

export class PasswordDebil extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "PasswordDebil";
  }
}

import { LARGO_MINIMO_PASSWORD } from "./parametros";

/** Mínimo razonable. La especificación no fija un valor, así que se documenta. */
export const LARGO_MINIMO = LARGO_MINIMO_PASSWORD;

/**
 * Cambio obligatorio de contraseña en el primer ingreso (FR-033).
 *
 * Hasta que se complete, la sesión no debe poder hacer nada más. Esa parte la
 * garantiza `contextoActual`, que resuelve el contexto sólo cuando la marca
 * está baja; acá se hace el cambio y se levanta la marca.
 */
export async function cambiarPasswordObligatorio(datos: {
  usuarioId: string;
  nuevaPassword: string;
}): Promise<void> {
  if (datos.nuevaPassword.length < LARGO_MINIMO) {
    throw new PasswordDebil(
      `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres`,
    );
  }

  await fijarPassword(datos.usuarioId, datos.nuevaPassword);

  await comoPlataforma("autenticacion", (tx) =>
    tx
      .update(usuario)
      .set({ debeCambiarPassword: false })
      .where(eq(usuario.id, datos.usuarioId)),
  );
}
