import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import { auth } from "@/lib/auth";
import { esperaRestante } from "./demora";
import { anotarIntento, estadoDeIntentos } from "./registro-intentos";

/**
 * Inicio de sesión (contrato de operaciones, sección Autenticación).
 *
 * Seis resultados posibles, todos explícitos. Nunca se devuelve un booleano ni
 * se lanza una excepción genérica: quien llama debe decidir qué hacer en cada
 * caso, y el compilador se lo exige.
 */
export type ResultadoLogin =
  | { tipo: "ok"; usuarioId: string }
  | { tipo: "debe_cambiar_password"; usuarioId: string }
  | { tipo: "credenciales_invalidas" }
  | { tipo: "cuenta_bloqueada" }
  | { tipo: "establecimiento_sin_acceso" }
  | { tipo: "demora_activa"; segundos: number };

export async function iniciarSesion(datos: {
  email: string;
  password: string;
  origen?: string | null;
}): Promise<ResultadoLogin> {
  const email = datos.email.toLowerCase().trim();

  // 1. La demora se evalúa ANTES de tocar la contraseña. Si se comprobaran
  //    primero las credenciales, el tiempo de respuesta distinguiría un correo
  //    existente de uno inventado.
  const { fallosConsecutivos, ultimoFallo } = await estadoDeIntentos(email);
  const restante = esperaRestante(fallosConsecutivos, ultimoFallo);

  if (restante > 0) {
    return { tipo: "demora_activa", segundos: Math.ceil(restante / 1000) };
  }

  // 2. Credenciales.
  let usuarioId: string;
  try {
    const resultado = await auth.api.signInEmail({ body: { email, password: datos.password } });
    usuarioId = resultado.user.id;
  } catch (error) {
    if (!(error instanceof APIError)) throw error;

    await anotarIntento({ emailIntentado: email, origen: datos.origen, exito: false });

    /**
     * Better Auth rechaza la cuenta bloqueada por su cuenta, y lo hace en el
     * orden correcto: verifica la contraseña ANTES del bloqueo. Comprobado —
     * con contraseña incorrecta devuelve INVALID_EMAIL_OR_PASSWORD aunque la
     * cuenta esté bloqueada.
     *
     * Por eso distinguir este código no abre ninguna fuga: sólo llega acá
     * quien ya demostró conocer la contraseña.
     */
    const codigo = (error.body as { code?: string } | undefined)?.code;
    if (codigo === "BANNED_USER") return { tipo: "cuenta_bloqueada" };

    // Mensaje único para el resto: si diferenciara "no existe" de "contraseña
    // incorrecta", el formulario se volvería un detector de correos
    // registrados.
    return { tipo: "credenciales_invalidas" };
  }

  // 3. Condiciones de la cuenta y de su establecimiento.
  const estado = await comoPlataforma("autenticacion", async (tx) => {
    const [cuenta] = await tx
      .select({
        banned: usuario.banned,
        anonimizadaEn: usuario.anonimizadaEn,
        debeCambiar: usuario.debeCambiarPassword,
      })
      .from(usuario)
      .where(eq(usuario.id, usuarioId))
      .limit(1);

    const [vinculo] = await tx
      .select({ estado: parqueadero.estado })
      .from(asignacion)
      .leftJoin(parqueadero, eq(parqueadero.id, asignacion.parqueaderoId))
      .where(eq(asignacion.usuarioId, usuarioId))
      .limit(1);

    return { cuenta, estadoEstablecimiento: vinculo?.estado ?? null };
  });

  if (!estado.cuenta || estado.cuenta.anonimizadaEn || estado.cuenta.banned) {
    await anotarIntento({ emailIntentado: email, usuarioId, origen: datos.origen, exito: false });
    return { tipo: "cuenta_bloqueada" };
  }

  if (estado.estadoEstablecimiento === "dado_de_baja") {
    await anotarIntento({ emailIntentado: email, usuarioId, origen: datos.origen, exito: false });
    return { tipo: "establecimiento_sin_acceso" };
  }

  // 4. Éxito: se anota, lo que además reinicia la racha de fallos.
  await anotarIntento({ emailIntentado: email, usuarioId, origen: datos.origen, exito: true });

  return estado.cuenta.debeCambiar
    ? { tipo: "debe_cambiar_password", usuarioId }
    : { tipo: "ok", usuarioId };
}

