import { and, desc, eq, gte } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { intentoLogin } from "@/db/esquema";
import { INTENTOS_EXAMINADOS, VENTANA_MINUTOS } from "./parametros";

/**
 * Registro de intentos de inicio de sesión (FR-008).
 *
 * Se anotan los exitosos y los fallidos. Los fallidos alimentan la demora
 * progresiva; los exitosos la reinician, porque marcan el final de una racha.
 *
 * El conteo va por CORREO INTENTADO y no por cuenta existente. Es deliberado:
 * si sólo se contaran los correos registrados, un atacante notaría la
 * diferencia de comportamiento y el mecanismo se volvería un detector de qué
 * correos existen (FR-006).
 */

export async function anotarIntento(datos: {
  emailIntentado: string;
  usuarioId?: string | null;
  origen?: string | null;
  exito: boolean;
}): Promise<void> {
  await comoPlataforma("autenticacion", (tx) =>
    tx.insert(intentoLogin).values({
      emailIntentado: datos.emailIntentado.toLowerCase().trim(),
      usuarioId: datos.usuarioId ?? null,
      origen: datos.origen ?? null,
      exito: datos.exito,
    }),
  );
}

export type EstadoIntentos = {
  fallosConsecutivos: number;
  ultimoFallo: Date | null;
};

/**
 * Cuenta los fallos consecutivos desde el último éxito, dentro de la ventana.
 *
 * "Consecutivos" es la palabra clave: un inicio de sesión exitoso corta la
 * racha, de modo que quien se equivocó tres veces y luego entró bien arranca
 * limpio la próxima vez.
 */
export async function estadoDeIntentos(
  emailIntentado: string,
): Promise<EstadoIntentos> {
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000);
  const email = emailIntentado.toLowerCase().trim();

  const recientes = await comoPlataforma("autenticacion", (tx) =>
    tx
      .select({ exito: intentoLogin.exito, ocurridoEn: intentoLogin.ocurridoEn })
      .from(intentoLogin)
      .where(
        and(
          eq(intentoLogin.emailIntentado, email),
          gte(intentoLogin.ocurridoEn, desde),
        ),
      )
      .orderBy(desc(intentoLogin.ocurridoEn))
      .limit(INTENTOS_EXAMINADOS),
  );

  let fallosConsecutivos = 0;
  let ultimoFallo: Date | null = null;

  for (const intento of recientes) {
    if (intento.exito) break; // el éxito corta la racha
    fallosConsecutivos += 1;
    ultimoFallo ??= intento.ocurridoEn;
  }

  return { fallosConsecutivos, ultimoFallo };
}
