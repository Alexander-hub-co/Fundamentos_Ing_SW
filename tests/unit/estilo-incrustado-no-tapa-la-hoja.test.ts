import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guardia contra el error que más veces ha roto una pantalla en este proyecto.
 *
 * UN ESTILO INCRUSTADO GANA SIEMPRE SOBRE UNA HOJA. Así que cuando un elemento
 * lleva `style={{ display: "flex" }}` y además una clase que en el teléfono lo
 * pasa a rejilla, la consulta de medios existe, se sirve, y es letra muerta. No
 * falla nada: simplemente la pantalla se ve mal, y sólo se descubre mirándola.
 *
 * Ha pasado CUATRO veces —el ancho de la barra lateral, el tamaño de los
 * campos, el relleno inferior que dejaba la barra de pestañas tapando el final,
 * y la disposición de las filas de horario y de tarifas—. Cada vez costó una
 * ronda de "sigue igual".
 *
 * Lo que se comprueba: si una clase aparece dentro de una consulta de medios
 * fijando cierta propiedad, ningún elemento que use esa clase puede fijar esa
 * misma propiedad en un atributo `style`.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Las propiedades que de verdad se pelean. */
const EN_DISPUTA = [
  "display",
  "padding",
  "padding-bottom",
  "grid-template-columns",
  "flex-direction",
  "width",
  "max-width",
  "min-width",
  "height",
  "font-size",
];

const aCamello = (css: string) =>
  css.replace(/-([a-z])/g, (_, letra: string) => letra.toUpperCase());

/**
 * Qué propiedades toca cada clase DENTRO de una consulta de medios.
 *
 * Sólo las de dentro: una clase que fija algo en el nivel base no está en
 * disputa, porque el estilo incrustado y ella dicen lo mismo en todo ancho.
 */
function clasesEnConsultasDeMedios(): Map<string, Set<string>> {
  const hoja = readFileSync(join(RAIZ, "src/app/globals.css"), "utf8");
  const encontrado = new Map<string, Set<string>>();

  for (const bloque of hoja.split("@media").slice(1)) {
    // Hasta donde se cierra la consulta: se cuentan llaves.
    let profundidad = 0;
    let fin = 0;
    for (let i = 0; i < bloque.length; i++) {
      if (bloque[i] === "{") profundidad++;
      if (bloque[i] === "}") {
        profundidad--;
        if (profundidad === 0) {
          fin = i;
          break;
        }
      }
    }

    const dentro = bloque.slice(0, fin);

    for (const regla of dentro.matchAll(/\.([a-z][\w-]*)[^{}]*\{([^}]*)\}/g)) {
      const clase = regla[1]!;
      const cuerpo = regla[2]!;

      for (const propiedad of EN_DISPUTA) {
        // Con la palabra completa: `padding` no debe casar con `padding-left`.
        if (new RegExp(`(^|[;\\s])${propiedad}\\s*:`).test(cuerpo)) {
          if (!encontrado.has(clase)) encontrado.set(clase, new Set());
          encontrado.get(clase)!.add(propiedad);
        }
      }
    }
  }

  return encontrado;
}

describe("ningún estilo incrustado tapa una regla de la hoja", () => {
  const enConsultas = clasesEnConsultasDeMedios();

  it("encuentra clases dentro de consultas de medios, para descartar que el patrón esté vacío", () => {
    expect(enConsultas.size).toBeGreaterThan(5);
  });

  it("no hay elementos que fijen incrustada una propiedad que su clase cambia por ancho", () => {
    const fuentes = globSync("src/app/**/*.tsx", { cwd: RAIZ });
    const hallazgos: string[] = [];

    for (const archivo of fuentes) {
      const codigo = readFileSync(join(RAIZ, archivo), "utf8");

      // Cada elemento que declara className y style a la vez, en cualquier
      // orden, dentro de la misma etiqueta.
      for (const etiqueta of codigo.matchAll(/<[A-Za-z][^>]*?>/gs)) {
        const texto = etiqueta[0]!;
        if (!texto.includes("className") || !texto.includes("style")) continue;

        for (const [clase, propiedades] of enConsultas) {
          if (!new RegExp(`\\b${clase}\\b`).test(texto)) continue;

          for (const propiedad of propiedades) {
            const camello = aCamello(propiedad);
            if (new RegExp(`\\b${camello}\\s*:`).test(texto)) {
              hallazgos.push(
                `${archivo}: la clase .${clase} cambia «${propiedad}» por ancho, ` +
                  `pero el elemento la fija incrustada y gana siempre`,
              );
            }
          }
        }
      }
    }

    expect(hallazgos).toEqual([]);
  });

  /**
   * El primo del mismo error: una regla base escrita DESPUÉS de la consulta de
   * medios que la modifica. Misma especificidad, así que gana la última, y la
   * consulta vuelve a ser letra muerta —salvo que se la sostenga con
   * `!important`, que es una regla que el próximo cambio rompe sin avisar—.
   *
   * Pasó dos veces la misma tarde: con el relleno del contenido y con el del
   * formulario de login.
   */
  it("ninguna regla base va después de la consulta de medios que la cambia", () => {
    const hoja = readFileSync(join(RAIZ, "src/app/globals.css"), "utf8");
    const lineas = hoja.split("\n");

    /** En qué línea empieza cada consulta de medios. */
    const consultas: { linea: number; clase: string; propiedad: string }[] = [];
    for (const [clase, propiedades] of enConsultas) {
      for (const propiedad of propiedades) {
        // Se busca la línea de la consulta que contiene esa clase.
        let dentro = false;
        let inicio = 0;
        let profundidad = 0;

        lineas.forEach((linea, i) => {
          if (linea.includes("@media")) {
            dentro = true;
            inicio = i;
            profundidad = 0;
          }
          if (dentro) {
            profundidad += (linea.match(/\{/g) ?? []).length;
            profundidad -= (linea.match(/\}/g) ?? []).length;
            if (linea.includes(`.${clase}`)) {
              consultas.push({ linea: inicio, clase, propiedad });
            }
            if (profundidad === 0 && i > inicio) dentro = false;
          }
        });
      }
    }

    const hallazgos: string[] = [];

    for (const { linea, clase, propiedad } of consultas) {
      // Reglas base —fuera de toda consulta— para esa clase, después de ahí.
      let profundidad = 0;
      let enConsulta = false;

      lineas.forEach((texto, i) => {
        if (texto.includes("@media")) enConsulta = true;
        profundidad += (texto.match(/\{/g) ?? []).length;
        profundidad -= (texto.match(/\}/g) ?? []).length;
        if (enConsulta && profundidad === 0) enConsulta = false;

        if (enConsulta || i <= linea) return;
        if (!new RegExp(`^\\.${clase}\\s*\\{`).test(texto)) return;

        // El cuerpo de esa regla base.
        const cuerpo = lineas.slice(i, i + 12).join("\n").split("}")[0] ?? "";
        if (new RegExp(`(^|[;\\s])${propiedad}\\s*:`).test(cuerpo)) {
          hallazgos.push(
            `.${clase} fija «${propiedad}» en la línea ${i + 1}, después de la ` +
              `consulta de medios de la línea ${linea + 1} que lo cambia: gana la base`,
          );
        }
      });
    }

    expect([...new Set(hallazgos)]).toEqual([]);
  });
});
