import { auth } from "@/lib/auth";
import { LARGO_MINIMO_PASSWORD } from "./parametros";
import { PasswordDebil } from "./cambio-obligatorio";

/**
 * Exige que una contraseña cumpla la política del proyecto.
 *
 * Existe porque el mínimo custodiaba sólo una de las tres puertas. Quien cambia
 * su propia contraseña pasaba por `cambiarPasswordObligatorio`, que sí valida;
 * pero un administrador restableciendo la de otro, o creando una cuenta,
 * escribía sin que nadie mirara el largo. El resultado era que una temporal de
 * un solo carácter abría sesión perfectamente.
 *
 * No basta con confiar en la validación de Better Auth: `fijarPassword` escribe
 * con el adaptador interno, que se salta la de la biblioteca además de la
 * nuestra. Y aunque no la saltara, su mínimo por defecto es más laxo que el que
 * este proyecto declaró.
 */
export function exigirPasswordFuerte(passwordEnClaro: string): void {
  if (passwordEnClaro.length < LARGO_MINIMO_PASSWORD) {
    throw new PasswordDebil(
      `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`,
    );
  }
}

/**
 * Fijar la contraseña de una cuenta desde el servidor.
 *
 * NO se usa `auth.api.setUserPassword` del plugin de administración: esa es una
 * ruta HTTP que exige la sesión de un administrador en las cabeceras, y el
 * dominio no tiene cabeceras — es código de servidor que ya comprobó la
 * autorización por su cuenta con `exigir()`.
 *
 * Se usa el contexto interno de Better Auth, que aplica el mismo algoritmo de
 * hash que el resto de la biblioteca. Así la contraseña queda escrita en el
 * mismo formato que produciría un cambio hecho por la vía normal.
 */
export async function fijarPassword(
  usuarioId: string,
  passwordEnClaro: string,
): Promise<void> {
  // La validación vive acá y no en quien llama: éste es el punto único por el
  // que una contraseña llega a la base desde el servidor, así que ninguna ruta
  // futura puede saltárselo por olvido.
  exigirPasswordFuerte(passwordEnClaro);

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(passwordEnClaro);
  await ctx.internalAdapter.updatePassword(usuarioId, hash);
}
