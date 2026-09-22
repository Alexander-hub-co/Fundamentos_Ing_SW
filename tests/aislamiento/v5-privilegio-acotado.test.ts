import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * V5 — La conexión privilegiada está acotada (FR-013).
 *
 * Esta prueba no ejecuta la aplicación: **lee el código fuente**. Es
 * deliberado. FR-013 exige que el privilegio global sea "explícito en cada
 * punto donde se ejerce", y esa es una propiedad del código, no del
 * comportamiento en tiempo de ejecución. Una prueba funcional no podría
 * detectar que alguien añadió `comoPlataforma` en un módulo de dominio
 * cualquiera: el sistema seguiría funcionando, sólo que sin aislamiento.
 *
 * Si esta prueba falla, no se "arregla" añadiendo el archivo a la lista. Se
 * revisa si ese módulo tiene derecho a atravesar el aislamiento.
 */

const SRC = fileURLToPath(new URL("../../src", import.meta.url));

/**
 * Los únicos lugares con derecho a usar la conexión privilegiada.
 *
 * - `db/ambito.ts` la define.
 * - `db/pools.ts` la construye.
 * - `lib/auth.ts` y `lib/sesion.ts`: la autenticación ocurre antes de que
 *   exista un ámbito, así que no puede pasar por una consulta con ámbito.
 * - `dominio/**`: operaciones del administrador general, que son globales por
 *   definición y exigen autorización antes de ejercerlas.
 * - `db/semilla.ts`: crea la primera cuenta, cuando no hay sesión posible.
 */
const AUTORIZADOS = [
  "db/ambito.ts",
  "db/pools.ts",
  "db/semilla.ts",
  "lib/auth.ts",
  "lib/sesion.ts",
  "dominio/",
];

/**
 * Quita comentarios antes de analizar.
 *
 * Sin esto, un archivo que sólo *menciona* `comoPlataforma` para explicar por
 * qué NO la usa quedaría marcado como infractor. La prueba debe mirar código,
 * no prosa.
 */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

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

describe("comoPlataforma sólo aparece donde corresponde", () => {
  it("ningún módulo no autorizado atraviesa el aislamiento", async () => {
    const archivos = await archivosFuente(SRC);
    const infractores: string[] = [];

    for (const archivo of archivos) {
      const contenido = sinComentarios(await readFile(archivo, "utf8"));
      if (!contenido.includes("comoPlataforma")) continue;

      const rel = relative(SRC, archivo).replaceAll("\\", "/");
      if (!AUTORIZADOS.some((permitido) => rel.startsWith(permitido))) {
        infractores.push(rel);
      }
    }

    expect(infractores, "Módulos que usan comoPlataforma sin autorización").toEqual([]);
  });

  it("la capa de interfaz nunca la usa", async () => {
    const archivos = await archivosFuente(join(SRC, "app"));
    const infractores: string[] = [];

    for (const archivo of archivos) {
      const contenido = sinComentarios(await readFile(archivo, "utf8"));
      if (contenido.includes("comoPlataforma")) {
        infractores.push(relative(SRC, archivo));
      }
    }

    // Las pantallas y acciones llaman al dominio, y es el dominio quien decide
    // si corresponde ejercer el privilegio — después de exigir autorización.
    expect(infractores, "Archivos de src/app que usan comoPlataforma").toEqual([]);
  });

  it("cada uso declara un motivo del conjunto cerrado", async () => {
    const archivos = await archivosFuente(SRC);
    const sinMotivo: string[] = [];
    const MOTIVOS = ["autenticacion", "administracion_plataforma"];

    for (const archivo of archivos) {
      const rel = relative(SRC, archivo).replaceAll("\\", "/");
      if (rel === "db/ambito.ts") continue; // es quien define el tipo

      const contenido = sinComentarios(await readFile(archivo, "utf8"));
      for (const llamada of contenido.matchAll(/comoPlataforma\(\s*("[^"]*")?/g)) {
        const motivo = llamada[1]?.replaceAll('"', "");
        if (!motivo || !MOTIVOS.includes(motivo)) {
          sinMotivo.push(`${rel}: ${llamada[0]}`);
        }
      }
    }

    expect(sinMotivo, "Usos sin motivo declarado").toEqual([]);
  });
});

describe("los pools no se alcanzan por fuera del contrato", () => {
  it("nadie importa dbPlatform salvo ambito.ts y quien lo construye", async () => {
    const archivos = await archivosFuente(SRC);
    const infractores: string[] = [];

    for (const archivo of archivos) {
      const rel = relative(SRC, archivo).replaceAll("\\", "/");
      if (rel === "db/pools.ts" || rel === "db/ambito.ts") continue;

      const contenido = sinComentarios(await readFile(archivo, "utf8"));
      // `lib/auth.ts` es la excepción declarada: Better Auth necesita el
      // adaptador de base directamente, no puede pasar por una transacción
      // con ámbito porque autentica antes de que exista uno.
      if (contenido.includes("dbPlatform") && rel !== "lib/auth.ts") {
        infractores.push(rel);
      }
    }

    expect(infractores, "Módulos que usan dbPlatform directamente").toEqual([]);
  });
});
