import { describe, expect, it } from "vitest";
import { diaDeAplicacion } from "@/dominio/convenios/dia";

/**
 * Contra qué día se cuenta el límite diario.
 *
 * Sin esto definido, "una vez al día" admite tres lecturas distintas y dos
 * parqueaderos con el mismo convenio cobrarían distinto.
 */

describe("el día es el calendario del establecimiento", () => {
  it("dos instantes del mismo día dan el mismo día", () => {
    const manana = new Date("2026-08-19T13:05:00Z"); // 08:05 en Bogotá
    const tarde = new Date("2026-08-20T02:30:00Z"); // 21:30 del 19 en Bogotá
    expect(diaDeAplicacion(manana)).toBe(diaDeAplicacion(tarde));
    expect(diaDeAplicacion(manana)).toBe("2026-08-19");
  });

  it("va de medianoche a medianoche, no en ventana móvil", () => {
    // Las 23:59 y las 00:01 están a dos minutos y son días distintos. Una
    // ventana móvil de veinticuatro horas los daría iguales.
    const antes = new Date("2026-08-20T04:59:00Z"); // 23:59 del 19
    const despues = new Date("2026-08-20T05:01:00Z"); // 00:01 del 20
    expect(diaDeAplicacion(antes)).toBe("2026-08-19");
    expect(diaDeAplicacion(despues)).toBe("2026-08-20");
  });

  it("usa la hora de Colombia y no la del servidor", () => {
    // Las 02:00 UTC del 20 son todavía las 21:00 del 19 en Bogotá. Si se
    // resolviera en UTC, el cupo se gastaría en el día equivocado.
    expect(diaDeAplicacion(new Date("2026-08-20T02:00:00Z"))).toBe("2026-08-19");
  });
});

describe("una permanencia que cruza la medianoche", () => {
  it("cuenta contra el día de la SALIDA, no el de la entrada", () => {
    const entrada = new Date("2026-08-19T04:00:00Z"); // martes 23:00
    const salida = new Date("2026-08-19T07:00:00Z"); // miércoles 02:00

    // El convenio se aplica al cobrar, y se cobra al salir.
    expect(diaDeAplicacion(entrada)).toBe("2026-08-18");
    expect(diaDeAplicacion(salida)).toBe("2026-08-19");
  });
});
