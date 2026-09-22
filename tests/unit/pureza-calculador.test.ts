import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * El calculador y el calendario tienen que seguir siendo puros.
 *
 * Que hoy no importen nada de la base es una propiedad que sostiene dos cosas:
 * que F2 se pueda probar sin un solo movimiento, y que la taquilla pueda
 * mostrar el total parcial sin consultar. Ninguna de las dos sobrevive a un
 * `import` distraído, y un `import` distraído no rompe ninguna otra prueba.
 *
 * Por eso se comprueba leyendo el texto de los archivos: no hay forma de que
 * esta propiedad se pierda en silencio.
 *
 * Vive en `unit` y no en `aislamiento`, que está reservado al aislamiento
 * multi-parqueadero. No es una prueba de ámbito.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const PUROS = [
  "src/dominio/calendario/expandir.ts",
  "src/dominio/tarifas/jornadas.ts",
  "src/dominio/tarifas/calcular.ts",
  // El motor de convenios se suma a la misma garantía: sin esto podría empezar
  // a consultar la política de redondeo o la cuenta de aplicaciones previas, y
  // el cobro dejaría de poder probarse sin base de datos.
  "src/dominio/convenios/aplicar.ts",
  "src/dominio/convenios/vigencia.ts",
  "src/dominio/cobro/redondeo.ts",
  "src/dominio/tarifas/modelos.ts",
];

/** Importaciones de valores, sin contar las de sólo tipos. */
function importacionesDeValor(fuente: string): string[] {
  const sinTipos = fuente.replace(/import\s+type\s+[\s\S]*?from\s+"[^"]+";/g, "");
  return [...sinTipos.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

describe("el calculador no toca la base de datos", () => {
  for (const archivo of PUROS) {
    it(`${archivo} no importa nada de src/db`, () => {
      const fuente = readFileSync(join(RAIZ, archivo), "utf8");
      const prohibidas = importacionesDeValor(fuente).filter(
        (i) => i.includes("@/db") || i.includes("drizzle") || i.includes("/pools"),
      );

      expect(prohibidas).toEqual([]);
    });
  }

  it("tampoco lee el reloj: el resultado depende sólo de sus argumentos", () => {
    // `new Date()` sin argumentos haría el cálculo no determinista, y con él
    // toda prueba de cobro dependería del momento en que corre.
    for (const archivo of PUROS) {
      const fuente = readFileSync(join(RAIZ, archivo), "utf8");
      expect(fuente).not.toMatch(/new Date\(\s*\)/);
      expect(fuente).not.toMatch(/Date\.now\(\)/);
    }
  });
});
