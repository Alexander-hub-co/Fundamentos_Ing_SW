import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";

/**
 * FR-035 — No existe recuperación de contraseña autogestionada.
 *
 * Es un requisito NEGATIVO, y ésos son los que se rompen sin que nadie note:
 * dentro de seis meses alguien agrega un "olvidé mi contraseña" con buena
 * intención, y la decisión de no tenerlo desaparece sin discusión.
 *
 * La decisión tiene motivo: Parquivo no envía correo, así que una recuperación
 * autogestionada no tendría canal de verificación. La única vía es que el
 * administrador general restablezca la contraseña (FR-034).
 *
 * Si esta prueba falla, no se borra: se decide conscientemente si se quiere
 * cambiar el requisito, y se enmienda la especificación primero.
 */

const SRC = fileURLToPath(new URL("../../src", import.meta.url));

async function archivosFuente(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const salida: string[] = [];
  for (const e of entradas) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await archivosFuente(ruta)));
    else if (/\.tsx?$/.test(e.name)) salida.push(ruta);
  }
  return salida;
}

function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no hay recuperación autogestionada en el código", () => {
  it("ninguna ruta ofrece restablecer la contraseña sin administrador", async () => {
    const archivos = await archivosFuente(join(SRC, "app"));
    const sospechosas: string[] = [];

    for (const archivo of archivos) {
      const rel = relative(SRC, archivo).replaceAll("\\", "/");
      // La ruta del administrador general SÍ puede restablecer (FR-034).
      if (rel.includes("(plataforma)")) continue;

      const contenido = sinComentarios(await readFile(archivo, "utf8")).toLowerCase();
      const señales = [
        "forgot-password",
        "forgotpassword",
        "olvide",
        "recuperar-password",
        "reset-password",
        "resetpassword",
      ];
      if (señales.some((s) => contenido.includes(s))) sospechosas.push(rel);
    }

    expect(
      sospechosas,
      "Archivos fuera del panel de plataforma que parecen ofrecer recuperación",
    ).toEqual([]);
  });

  it("no existe una ruta /olvide-mi-contrasena ni equivalente", async () => {
    const archivos = await archivosFuente(join(SRC, "app"));
    const rutas = archivos
      .map((a) => relative(SRC, a).replaceAll("\\", "/"))
      .filter((r) => r.endsWith("page.tsx") || r.endsWith("route.ts"));

    const prohibidas = rutas.filter((r) =>
      /(olvid|recuper|forgot|reset)/i.test(r),
    );

    expect(prohibidas).toEqual([]);
  });
});

describe("la configuración de autenticación no habilita el envío de correo", () => {
  it("no hay proveedor de correo configurado", () => {
    // Si algún día se configura `sendResetPassword` o similar, Parquivo pasa a
    // depender de un servicio externo — que es justamente lo que la decisión de
    // clarificación evitó.
    const opciones = auth.options as Record<string, unknown>;
    const emailAndPassword = opciones.emailAndPassword as
      | Record<string, unknown>
      | undefined;

    expect(emailAndPassword?.sendResetPassword).toBeUndefined();
    expect(opciones.emailVerification).toBeUndefined();
  });

  it("el registro público está deshabilitado (FR-014)", () => {
    const opciones = auth.options as Record<string, unknown>;
    const emailAndPassword = opciones.emailAndPassword as
      | Record<string, unknown>
      | undefined;

    expect(emailAndPassword?.disableSignUp).toBe(true);
  });
});
