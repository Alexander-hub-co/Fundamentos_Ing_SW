import { describe, expect, it } from "vitest";
import { CODIGO_DE_CLASE, clasificarPorPlaca } from "@/dominio/vehiculos/clasificar";

/**
 * La regla que la constitución fija y manda aislar.
 *
 * Se prueba aquí, sola, y no a través de la taquilla: si estuviera dispersa en
 * la interfaz haría falta montar media aplicación para comprobar que una placa
 * que termina en dígito es un carro.
 */

const clase = (p: string) => {
  const r = clasificarPorPlaca(p);
  return r.tipo === "reconocida" ? r.clase : r.tipo;
};

describe("el último carácter decide", () => {
  it("termina en dígito, es carro", () => {
    expect(clase("ABC123")).toBe("carro");
    expect(clase("XYZ001")).toBe("carro");
  });

  it("termina en letra, es moto", () => {
    expect(clase("ABC12D")).toBe("moto");
    expect(clase("XYZ99A")).toBe("moto");
  });
});

describe("la placa llega como la escribió una persona", () => {
  it("no importan mayúsculas, espacios ni guiones", () => {
    for (const escrita of ["abc 123", "ABC-123", "abc123", " Abc123 "]) {
      const r = clasificarPorPlaca(escrita);
      expect(r.tipo).toBe("reconocida");
      if (r.tipo === "reconocida") {
        expect(r.clase).toBe("carro");
        expect(r.placa).toBe("ABC123");
      }
    }
  });

  it("devuelve la placa normalizada, que es como se guarda y se compara", () => {
    const r = clasificarPorPlaca("abc-12d");
    expect(r.tipo === "reconocida" && r.placa).toBe("ABC12D");
  });
});

describe("lo que NO hace: adivinar", () => {
  it("una placa vacía se rechaza", () => {
    expect(clasificarPorPlaca("").tipo).toBe("rechazada");
    expect(clasificarPorPlaca("   ").tipo).toBe("rechazada");
  });

  it("una placa demasiado corta se rechaza, no se clasifica por defecto", () => {
    // Éste es el caso que la constitución nombra: clasificar por defecto metería
    // el vehículo con la tarifa equivocada, y eso se descubre al cobrar, con el
    // cliente delante.
    const r = clasificarPorPlaca("AB1");
    expect(r.tipo).toBe("rechazada");
    expect(r.tipo === "rechazada" && r.motivo).toMatch(/no tiene forma de placa/);
  });

  it("una placa demasiado larga se rechaza", () => {
    expect(clasificarPorPlaca("ABCDEF12345").tipo).toBe("rechazada");
  });

  it("el motivo del rechazo es accionable, no un código", () => {
    const r = clasificarPorPlaca("XX");
    expect(r.tipo === "rechazada" && r.motivo).toMatch(/vuelva a escribirla/);
  });
});

describe("el puente con el catálogo", () => {
  it("está en un solo lugar", () => {
    // Si esto se duplicara, cambiar la regla obligaría a buscarla por media
    // aplicación. Se prueba que exista y sea el único.
    expect(CODIGO_DE_CLASE.carro).toBe("automovil");
    expect(CODIGO_DE_CLASE.moto).toBe("motocicleta");
    expect(Object.keys(CODIGO_DE_CLASE)).toHaveLength(2);
  });
});
