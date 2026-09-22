import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tres proyectos separados a propósito.
 *
 * `aislamiento` corre contra una instancia real de PostgreSQL y verifica el
 * Principio I de la constitución. No admite base simulada: lo que hay que
 * probar es que las políticas del motor rechazan la fila, y sustituir la base
 * por un doble eliminaría exactamente el sujeto de la prueba.
 *
 * DENTRO de cada proyecto que toca la base, los archivos corren en serie
 * (`fileParallelism: false`) porque cada prueba manipula el ámbito de la
 * conexión y limpia tablas compartidas.
 *
 * ENTRE proyectos hacía falta lo mismo y faltaba. `integracion` y `aislamiento`
 * comparten una sola base de pruebas, y por defecto los proyectos corren en
 * paralelo: bastaba con que una prueba dejara una fila atrás para que el
 * borrado de otra fallara por clave foránea, y el síntoma aparecía en un
 * archivo que no tenía nada que ver con la causa. Pasó de verdad, con una fila
 * de `politica_cobro` que rompió las pruebas de aislamiento del equipo y de los
 * turnos.
 *
 * `groupOrder` lo resuelve: los grupos corren de menor a mayor, así que
 * `aislamiento` no empieza hasta que `integracion` terminó. `unit` se queda en
 * el primer grupo porque no toca la base y no le estorba a nadie.
 */

// En Vitest 4 la configuración de `resolve` no se hereda del nivel raíz hacia
// los proyectos: cada uno declara la suya.
const resolve = {
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
};

const comun = {
  environment: "node" as const,
  setupFiles: ["./tests/setup.ts"],
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          ...comun,
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        resolve,
        test: {
          ...comun,
          name: "integracion",
          include: ["tests/integracion/**/*.test.ts"],
          fileParallelism: false,
          sequence: { groupOrder: 0 },
        },
      },
      {
        resolve,
        test: {
          ...comun,
          name: "aislamiento",
          include: ["tests/aislamiento/**/*.test.ts"],
          fileParallelism: false,
          // Después de `integracion`, nunca a la vez: comparten base.
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
