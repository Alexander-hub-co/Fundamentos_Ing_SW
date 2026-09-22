import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Un archivo "use server" sólo puede exportar funciones asíncronas.
 *
 * Esta prueba nace de un defecto real: la pantalla de cambio de contraseña
 * reexportaba una constante numérica desde su archivo de acciones. Next
 * convierte cada exportación de esos archivos en una referencia de servidor,
 * de modo que la constante llegaba al navegador como un objeto y React
 * rechazaba el atributo que la recibía.
 *
 * Lo importante: NI el compilador de TypeScript NI el linter lo detectan. Sólo
 * se manifiesta en tiempo de ejecución, en el navegador. Por eso hace falta una
 * comprobación propia, del mismo estilo que la de V5.
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

/** ¿El archivo lleva la directiva en su primera línea significativa? */
function esUseServer(fuente: string): boolean {
  const primera = fuente
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return primera === '"use server";' || primera === "'use server';";
}

describe('los archivos "use server" sólo exportan funciones asíncronas', () => {
  it("ninguno exporta constantes, clases ni valores", async () => {
    const archivos = await archivosFuente(SRC);
    const infractores: string[] = [];

    for (const archivo of archivos) {
      const contenido = await readFile(archivo, "utf8");
      if (!esUseServer(contenido)) continue;

      const limpio = sinComentarios(contenido);
      const rel = relative(SRC, archivo).replaceAll("\\", "/");

      // `export type` y `export interface` se borran al compilar, así que no
      // llegan a convertirse en referencias de servidor.
      for (const linea of limpio.split("\n")) {
        const t = linea.trim();
        if (!t.startsWith("export")) continue;
        if (/^export\s+(type|interface)\b/.test(t)) continue;
        if (/^export\s+async\s+function\b/.test(t)) continue;
        infractores.push(`${rel}: ${t.slice(0, 70)}`);
      }
    }

    expect(
      infractores,
      'Exportaciones inválidas en archivos "use server"',
    ).toEqual([]);
  });

  it("hay al menos un archivo de acciones, para que la prueba no pase por vacío", async () => {
    const archivos = await archivosFuente(SRC);
    let encontrados = 0;
    for (const archivo of archivos) {
      if (esUseServer(await readFile(archivo, "utf8"))) encontrados += 1;
    }
    expect(encontrados).toBeGreaterThan(0);
  });
});
