import { describe, expect, it } from "vitest";
import { esPlacaPlausible, normalizarPlaca } from "@/dominio/vehiculos/placa";

describe("normalizar placas", () => {
  it("todas las formas de escribir la misma placa dan lo mismo", () => {
    for (const bruta of ["ABC123", "abc123", "abc 123", "ABC-123", " abc-123 ", "a.b.c.1.2.3"]) {
      expect(normalizarPlaca(bruta)).toBe("ABC123");
    }
  });

  it("quita acentos, que alguien podría escribir por error", () => {
    expect(normalizarPlaca("ÁBC123")).toBe("ABC123");
  });

  it("una placa vacía o sin letras ni números queda vacía", () => {
    expect(normalizarPlaca("   ")).toBe("");
    expect(normalizarPlaca("--")).toBe("");
  });
});

describe("plausibilidad", () => {
  it("acepta los formatos colombianos vigentes", () => {
    expect(esPlacaPlausible("ABC123")).toBe(true); // carro
    expect(esPlacaPlausible("ABC12D")).toBe(true); // moto
  });

  it("rechaza lo que claramente no es una placa", () => {
    expect(esPlacaPlausible("A1")).toBe(false);
    expect(esPlacaPlausible("ABCDEFGHIJ")).toBe(false);
  });
});
