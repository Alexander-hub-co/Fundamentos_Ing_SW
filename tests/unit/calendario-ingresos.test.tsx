import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IngresosPorDia } from "@/app/(establecimiento)/reportes/graficos";
import type { PorDia } from "@/dominio/reportes/resumen";

/**
 * La geometría del calendario de ingresos.
 *
 * Existe por un fallo que sólo se veía MIRANDO la pantalla: un mes dibujado en
 * barras ponía veintitantas etiquetas encima de veintitantas columnas de pocos
 * píxeles, y se pisaban hasta que no se leía ninguna. Compilaba y las pruebas
 * pasaban.
 *
 * Lo que se protege acá es lo que aquella vez nadie comprobó: que la forma
 * elegida corresponda a la cantidad de datos, que el mes caiga en la columna
 * que le toca, y que el importe esté escrito y no sólo codificado en color.
 */

/** Días consecutivos desde una fecha, con los importes dados. */
function dias(desde: string, importes: number[]): PorDia[] {
  return importes.map((ingresos, i) => {
    const dia = new Date(`${desde}T12:00:00-05:00`);
    dia.setDate(dia.getDate() + i);
    return { dia, ingresos, cerrado: ingresos === 0 };
  });
}

const contar = (html: string, aguja: string) => html.split(aguja).length - 1;

describe("la forma la elige la cantidad de días", () => {
  it("una semana se dibuja en barras", () => {
    const html = renderToStaticMarkup(
      <IngresosPorDia datos={dias("2026-08-17", [1, 2, 3, 4, 5, 6, 7])} />,
    );

    expect(html).not.toContain("calendario");
  });

  it("un mes se dibuja en calendario, no en barras", () => {
    const html = renderToStaticMarkup(
      <IngresosPorDia datos={dias("2026-08-01", Array.from({ length: 31 }, () => 1_000))} />,
    );

    expect(html).toContain("calendario");
  });
});

describe("el mes cabe entero y cae donde debe", () => {
  it("los 31 días tienen su celda", () => {
    const html = renderToStaticMarkup(
      <IngresosPorDia datos={dias("2026-08-01", Array.from({ length: 31 }, (_, i) => i * 100))} />,
    );

    expect(contar(html, "calendario-celda")).toBe(31);
  });

  it("un mes que empieza en sábado lleva cinco huecos antes", () => {
    // El 1 de agosto de 2026 es sábado, y la semana arranca en lunes: lun, mar,
    // mié, jue, vie quedan vacíos. Sin este desplazamiento el mes entero saldría
    // corrido una columna y el patrón semanal —que los domingos no se vende—
    // sería mentira.
    const html = renderToStaticMarkup(
      <IngresosPorDia datos={dias("2026-08-01", Array.from({ length: 31 }, () => 500))} />,
    );

    expect(contar(html, "calendario-hueco")).toBe(5);
  });

  it("un mes que empieza en lunes no lleva ninguno", () => {
    // El 1 de junio de 2026 es lunes.
    const html = renderToStaticMarkup(
      <IngresosPorDia datos={dias("2026-06-01", Array.from({ length: 30 }, () => 500))} />,
    );

    expect(contar(html, "calendario-hueco")).toBe(0);
  });
});

describe("el color no transporta el dato", () => {
  it("cada día lleva su importe escrito, no sólo su tono", () => {
    // Quien no distingue tonos, o mira una impresión en blanco y negro, tiene
    // que poder leer la cifra igual.
    const html = renderToStaticMarkup(
      <IngresosPorDia datos={dias("2026-08-01", [500_000, ...Array.from({ length: 20 }, () => 0)])} />,
    );

    expect(html).toContain("$500k");
    // Y el día sin cobros se distingue de uno flojo: no es lo mismo cerrar que
    // vender poco.
    expect(html).toContain("—");
  });

  it("el día en cero tiene escalón propio y no comparte con los flojos", () => {
    const html = renderToStaticMarkup(
      <IngresosPorDia
        datos={dias("2026-08-01", [0, 1, ...Array.from({ length: 19 }, () => 100_000)])}
      />,
    );

    expect(html).toContain("dia-0");
    expect(html).toContain("dia-1");
  });
});
