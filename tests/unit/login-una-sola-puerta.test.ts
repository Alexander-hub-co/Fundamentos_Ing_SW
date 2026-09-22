import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardia estructural: iniciar sesión tiene UNA sola puerta.
 *
 * Existe porque el fallo que previene ya ocurrió y ninguna prueba lo vio. La
 * acción del formulario llamaba directo a `auth.api.signInEmail`, saltándose la
 * demora contra fuerza bruta (FR-006), el registro de intentos (FR-008) y las
 * comprobaciones de cuenta anonimizada y establecimiento dado de baja. Las
 * pruebas de integración seguían verdes porque ejercen la función de dominio,
 * que era precisamente la que la aplicación no llamaba.
 *
 * Una prueba de comportamiento no habría atrapado eso: la pantalla funcionaba.
 * Lo que falla acá es la FORMA del código, así que la comprobación es sobre el
 * código.
 */

const RAIZ = join(import.meta.dirname, "../..", "src");

/** El único módulo autorizado a pedirle credenciales a Better Auth. */
const PUERTA = join(RAIZ, "dominio/autenticacion/iniciar-sesion.ts");

/**
 * El código, sin comentarios.
 *
 * Se quitan antes de buscar porque estas mismas pruebas y los comentarios que
 * explican el fallo nombran las funciones prohibidas. Buscar el texto crudo
 * haría que documentar el problema lo reintrodujera.
 */
function codigo(ruta: string): string {
  return readFileSync(ruta, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(n) ? [ruta] : [];
  });
}

describe("iniciar sesión tiene una sola puerta", () => {
  it("sólo el dominio comprueba credenciales", () => {
    const infractores = archivos(RAIZ)
      .filter((f) => f !== PUERTA)
      .filter((f) => codigo(f).includes("auth.api.signInEmail("));

    expect(
      infractores,
      "Estos módulos comprueban credenciales por su cuenta y se saltan la demora " +
        "y el registro de intentos. Deben llamar a dominio/autenticacion/iniciar-sesion.",
    ).toEqual([]);
  });

  it("la acción del formulario pasa por el dominio", () => {
    const accion = readFileSync(join(RAIZ, "app/(auth)/login/acciones.ts"), "utf8");
    expect(accion).toContain("@/dominio/autenticacion/iniciar-sesion");
  });

  it("no hay un endpoint HTTP que reciba credenciales", () => {
    // Montar el manejador de Better Auth en una ruta publica reabre la puerta:
    // `POST /api/auth/sign-in/email` entrega una sesión sin pasar por nada de
    // lo anterior. Nada del navegador lo necesita —no se usa su biblioteca de
    // cliente y toda operación va por Server Actions—, así que no se monta.
    const expuestos = archivos(join(RAIZ, "app")).filter((f) => {
      const t = codigo(f);
      return t.includes("toNextJsHandler") || t.includes("better-auth/next-js");
    });

    expect(
      expuestos,
      "Montar el manejador de Better Auth expone POST /api/auth/sign-in/email, " +
        "que entrega una sesión saltándose la demora y el registro de intentos.",
    ).toEqual([]);
  });
});
