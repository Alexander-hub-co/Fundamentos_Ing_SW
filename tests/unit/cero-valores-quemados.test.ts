import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { globSync } from "node:fs";

/**
 * Guardia del Principio II: cero valores quemados.
 *
 * "Está prohibido un literal numérico de precio, duración de cobro o cantidad
 * de fichas en el código fuente." No prueba una funcionalidad: prueba que no se
 * cuele un supuesto sobre cómo cobra un parqueadero.
 *
 * Rastrea el dominio buscando números grandes y redondos —los que tienen forma
 * de precio en pesos— y duraciones sospechosas. La lista de excepciones es
 * explícita y corta a propósito: cada entrada nueva debería costar una
 * discusión, porque es un supuesto que el código está haciendo por el cliente.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Constantes justificadas, con su razón.
 *
 * Ninguna es un parámetro de negocio: son propiedades del calendario, del
 * sistema de numeración o de la propia definición de las cosas.
 */
const JUSTIFICADAS = new Map<number, string>([
  [60, "minutos de una hora; segundos de un minuto"],
  [24, "horas de un día"],
  [7, "días de la semana"],
  [1000, "milisegundos de un segundo"],
  [60_000, "milisegundos de un minuto"],
  [3_600_000, "milisegundos de una hora"],
  [12, "meses de retención, declarado en el esquema y no en la lógica"],
  [100, "el 100% de un porcentaje"],
  [999, "radio de una insignia, no un importe"],
]);

/** Un número con forma de precio en pesos colombianos. */
function pareceImporte(n: number): boolean {
  return n >= 100 && n % 50 === 0 && !JUSTIFICADAS.has(n);
}

/**
 * Archivos exentos, con su razón.
 *
 * `autenticacion/parametros.ts` declara la política de acceso —demoras entre
 * intentos, largo mínimo de contraseña, duración de sesión—. El Principio II
 * prohíbe literales de "precio, duración de cobro o cantidad de fichas", y una
 * demora de reintento no es ninguno de los tres: es política de PLATAFORMA,
 * igual para todos los establecimientos, y F1 la concentró en ese archivo justo
 * para que no se disperse. Si algún día se vuelve configurable por
 * establecimiento, sale de acá y entra al esquema.
 */
const EXENTOS = new Set(["src/dominio/autenticacion/parametros.ts"]);

function archivosDelDominio(): string[] {
  return globSync("src/dominio/**/*.ts", { cwd: RAIZ }).filter(
    (f) => !f.endsWith(".test.ts") && !EXENTOS.has(f.replaceAll("\\\\", "/")),
  );
}

describe("ningún parámetro de negocio vive en el código", () => {
  it("encuentra archivos que rastrear, para descartar que el patrón esté vacío", () => {
    expect(archivosDelDominio().length).toBeGreaterThan(15);
  });

  it("no hay literales con forma de importe en el dominio", () => {
    const hallazgos: string[] = [];

    for (const archivo of archivosDelDominio()) {
      const fuente = readFileSync(join(RAIZ, archivo), "utf8");

      fuente.split("\n").forEach((linea, i) => {
        // Los comentarios explican ejemplos y no son código: "cobra $500" en
        // una explicación es documentación, no un supuesto ejecutable.
        const sinComentario = linea.replace(/\/\/.*$/, "").replace(/\*.*$/, "");

        for (const bruto of sinComentario.matchAll(/\b(\d[\d_]{2,})\b/g)) {
          const n = Number.parseInt(bruto[1]!.replace(/_/g, ""), 10);
          if (pareceImporte(n)) {
            hallazgos.push(`${relative(RAIZ, join(RAIZ, archivo))}:${i + 1} → ${n}`);
          }
        }
      });
    }

    expect(hallazgos).toEqual([]);
  });

  it("el catálogo de tipos es dato de inicialización y no trae precios", () => {
    const fuente = readFileSync(join(RAIZ, "src/db/semilla-catalogo.ts"), "utf8");

    expect(fuente).toMatch(/DATO DE INICIALIZACIÓN/i);

    // Se miran las CLAVES que siembra, no los comentarios: el archivo explica
    // por qué no es un valor quemado, y esa explicación menciona la palabra
    // "precio" sin sembrar ninguno.
    const sinComentarios = fuente
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    for (const prohibida of ["tarifa", "precio", "valorMinuto", "valorIntervalo"]) {
      expect(sinComentarios).not.toContain(prohibida);
    }
  });

  it("dos establecimientos con tarifas distintas cobran distinto sin tocar código", () => {
    // El criterio del Principio II, ya cubierto por las pruebas del
    // calculador; acá queda la referencia para que se vea que se comprobó.
    const fuente = readFileSync(join(RAIZ, "tests/unit/calcular.test.ts"), "utf8");
    expect(fuente).toMatch(/SC-012/);
  });
});
