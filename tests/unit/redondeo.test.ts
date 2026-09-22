import { describe, expect, it } from "vitest";
import { REDONDEO_INICIAL, redondear } from "@/dominio/cobro/redondeo";

/**
 * El redondeo es configuración del establecimiento, no una constante.
 *
 * La garantía que importa: NUNCA sube el total. Redondear hacia arriba cobraría
 * pesos que ningún cálculo produjo, y ése es el problema contable que la regla
 * existe para evitar.
 */

describe("cada regla redondea a su paso", () => {
  it("al peso deja el importe intacto", () => {
    expect(redondear(6_850, "peso")).toBe(6_850);
    expect(redondear(1, "peso")).toBe(1);
  });

  it("a la cincuentena baja al múltiplo de cincuenta", () => {
    expect(redondear(6_850, "cincuentena")).toBe(6_850);
    expect(redondear(6_870, "cincuentena")).toBe(6_850);
    expect(redondear(6_899, "cincuentena")).toBe(6_850);
  });

  it("a la centena baja al múltiplo de cien", () => {
    // El caso del enunciado: $6.850 se convierte en $6.800, nunca en $6.900.
    expect(redondear(6_850, "centena")).toBe(6_800);
    expect(redondear(6_999, "centena")).toBe(6_900);
  });
});

describe("ninguna regla sube nunca el total", () => {
  it("para cualquier importe hasta cien mil", () => {
    for (const regla of ["peso", "cincuentena", "centena"] as const) {
      for (let n = 0; n <= 100_000; n += 137) {
        expect(redondear(n, regla)).toBeLessThanOrEqual(n);
      }
    }
  });

  it("y nunca deja un resultado negativo con importes válidos", () => {
    for (const regla of ["peso", "cincuentena", "centena"] as const) {
      expect(redondear(0, regla)).toBe(0);
      expect(redondear(49, regla)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("el valor inicial", () => {
  it("es el más conservador de los tres", () => {
    // Redondear a la cincuentena o a la centena es una decisión de caja que
    // quien vende el servicio tiene que tomar a conciencia, no algo que le
    // aparezca puesto sin haberlo pedido.
    expect(REDONDEO_INICIAL).toBe("peso");
    expect(redondear(6_850, REDONDEO_INICIAL)).toBe(6_850);
  });
});
