"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { iniciarSesion as iniciarSesionDeDominio } from "@/dominio/autenticacion/iniciar-sesion";
import { preferenciasDe } from "@/dominio/preferencias/gestionar";
import { fijarApariencia, ACENTO_POR_DEFECTO, TEMA_POR_DEFECTO } from "@/lib/apariencia";

export type EstadoLogin = { error?: string };

/**
 * Inicio de sesión y encaminamiento por rol.
 *
 * Esta acción NO comprueba credenciales por su cuenta: se lo pide al dominio.
 * Antes llamaba directamente a `auth.api.signInEmail`, y esa línea de más se
 * saltaba en silencio la demora contra fuerza bruta (FR-006), el registro de
 * intentos (FR-008) y las comprobaciones de cuenta anonimizada y de
 * establecimiento dado de baja. La pantalla funcionaba, así que nada avisaba;
 * las pruebas pasaban porque ejercen el dominio, que era justamente lo que la
 * aplicación no usaba.
 *
 * El destino lo decide el rol de la asignación, nunca un parámetro de la
 * petición: no existe "a dónde quiero ir", existe "a dónde me corresponde".
 */
export async function iniciarSesion(
  _previo: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingrese su correo y su contraseña." };
  }

  const cabeceras = await headers();
  const resultado = await iniciarSesionDeDominio({
    email,
    password,
    origen: origenDe(cabeceras),
  });

  switch (resultado.tipo) {
    case "credenciales_invalidas":
      // Mensaje idéntico para correo inexistente y contraseña incorrecta: si
      // difirieran, el formulario se convertiría en un detector de qué correos
      // están registrados.
      return { error: "Correo o contraseña incorrectos." };

    case "demora_activa":
      return {
        error:
          resultado.segundos === 1
            ? "Demasiados intentos fallidos. Espere 1 segundo antes de volver a intentar."
            : `Demasiados intentos fallidos. Espere ${resultado.segundos} segundos antes de volver a intentar.`,
      };

    case "cuenta_bloqueada":
      return {
        error:
          "Esta cuenta está bloqueada. Comuníquese con el administrador para recuperar el acceso.",
      };

    case "establecimiento_sin_acceso":
      return {
        error:
          "El establecimiento al que pertenece esta cuenta ya no está activo. Comuníquese con el administrador.",
      };

    case "debe_cambiar_password":
      redirect("/cambiar-password");
      break;

    case "ok":
      break;
  }

  let contexto;
  try {
    contexto = await contextoActual(cabeceras);
  } catch (error) {
    if (error instanceof DebeCambiarPassword) redirect("/cambiar-password");
    throw error;
  }

  // La apariencia guardada de esta cuenta pasa a la cookie con la que se pinta
  // el HTML. Sin este paso, quien eligió el tema claro en su computador entraría
  // en oscuro desde otro equipo: la preferencia estaría guardada pero no puesta.
  const preferencias = await preferenciasDe(contexto);
  await fijarApariencia(preferencias.tema, preferencias.acento);

  redirect(contexto.tipo === "plataforma" ? "/panel" : "/establecimiento");
}

export async function cerrarSesion() {
  await auth.api.signOut({ headers: await headers() });

  // La apariencia vuelve al punto de partida: la cookie es de la cuenta que se
  // fue, y dejarla puesta le mostraría al siguiente los colores del anterior.
  await fijarApariencia(TEMA_POR_DEFECTO, ACENTO_POR_DEFECTO);

  redirect("/login");
}

/**
 * De dónde vino el intento, para el registro.
 *
 * Se prefiere `x-forwarded-for` porque en producción hay un proxy delante y la
 * dirección de la conexión sería siempre la suya. Se toma el primer valor de la
 * lista, que es el cliente original; los siguientes son los proxies del camino.
 */
function origenDe(cabeceras: Headers): string | null {
  const reenviado = cabeceras.get("x-forwarded-for");
  if (reenviado) return reenviado.split(",")[0]?.trim() || null;
  return cabeceras.get("x-real-ip");
}
