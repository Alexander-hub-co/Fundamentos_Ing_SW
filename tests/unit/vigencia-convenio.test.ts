import { describe, expect, it } from "vitest";
import { vencimientoDe } from "@/dominio/convenios/vigencia";

/**
 * Las vigencias que se declaran por su nombre.
 *
 * Salieron de descartar el asistente de IA: lo que hacía falta no era
 * interpretar prosa sino ofrecer las duraciones con las que el negocio nombra
 * sus acuerdos largos.
 */

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("sumar la duración acordada", () => {
  it("una mensualidad dura un mes", () => {
    expect(iso(vencimientoDe(new Date(2026, 0, 15), "mensual"))).toBe("2026-02-15");
  });

  it("una trimestral dura tres meses", () => {
    expect(iso(vencimientoDe(new Date(2026, 0, 15), "trimestral"))).toBe("2026-04-15");
  });

  it("una semestral dura seis meses", () => {
    expect(iso(vencimientoDe(new Date(2026, 0, 15), "semestral"))).toBe("2026-07-15");
  });

  it("una anual cruza el año", () => {
    expect(iso(vencimientoDe(new Date(2026, 7, 19), "anual"))).toBe("2027-08-19");
  });

  it("se cuentan meses, no treinta días", () => {
    // Febrero tiene veintiocho, y aun así la mensualidad que empieza el 1 de
    // febrero vence el 1 de marzo. Lo acordado fue un mes.
    expect(iso(vencimientoDe(new Date(2026, 1, 1), "mensual"))).toBe("2026-03-01");
  });
});

describe("cuando el día no existe en el mes destino", () => {
  it("el 31 de enero vence el 28 de febrero, NO el 3 de marzo", () => {
    // El caso que motiva la función. `setMonth(mes + 1)` desborda en silencio y
    // devuelve marzo; cobrarle al cliente tres días de más porque el calendario
    // no cuadra es la clase de error que nadie encuentra revisando.
    expect(iso(vencimientoDe(new Date(2026, 0, 31), "mensual"))).toBe("2026-02-28");
  });

  it("en año bisiesto recorta al 29", () => {
    expect(iso(vencimientoDe(new Date(2028, 0, 31), "mensual"))).toBe("2028-02-29");
  });

  it("el 31 de marzo vence el 30 de abril", () => {
    expect(iso(vencimientoDe(new Date(2026, 2, 31), "mensual"))).toBe("2026-04-30");
  });

  it("el 31 de agosto, a seis meses, vence el 28 de febrero", () => {
    expect(iso(vencimientoDe(new Date(2026, 7, 31), "semestral"))).toBe("2027-02-28");
  });
});

describe("el vencimiento siempre es posterior al inicio", () => {
  it("para cualquier duración y cualquier día del año", () => {
    // Lo exige la restricción `convenio_vigencia_coherente`: si alguna
    // combinación produjera una fecha anterior o igual, la fila se rechazaría
    // al guardarla y el fallo aparecería recién en producción.
    const duraciones = ["mensual", "trimestral", "semestral", "anual"] as const;
    for (let dia = 0; dia < 366; dia++) {
      const desde = new Date(2026, 0, 1 + dia);
      for (const d of duraciones) {
        expect(vencimientoDe(desde, d).getTime()).toBeGreaterThan(desde.getTime());
      }
    }
  });
});
