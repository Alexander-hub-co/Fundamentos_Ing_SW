import { describe, expect, it } from "vitest";
import {
  codigoDeCuenta,
  esCodigoDeCuentaValido,
  esSiglaValida,
  siglaConDesempate,
  siglaDe,
  SIGLA_PLATAFORMA,
} from "@/dominio/parqueaderos/sigla";

describe("sigla del establecimiento", () => {
  it("toma la inicial de cada palabra con significado", () => {
    expect(siglaDe("Parqueadero Centro Historico")).toBe("PCH");
    expect(siglaDe("Parqueadero El Centro")).toBe("PEC");
  });

  it("ignora los acentos, que nadie escribe de forma consistente", () => {
    expect(siglaDe("Parqueadero Centro Histórico")).toBe("PCH");
    expect(siglaDe("Párking Ñuñoa Sur")).toBe("PNS");
  });

  it("descarta los nexos, que no distinguen a un local de otro", () => {
    expect(siglaDe("Parqueadero de la Estación")).toBe("PES");
    expect(siglaDe("Garaje del Norte")).toBe("GNO");
  });

  it("completa desde la última palabra cuando no hay tres iniciales", () => {
    // "El" no se descarta: conservarlo hace que "Parqueadero El Centro" dé PEC,
    // que sigue el orden de las palabras, en vez de PCE, que lo altera.
    expect(siglaDe("El Dorado")).toBe("EDO");
    expect(siglaDe("Zona Azul")).toBe("ZAZ");
  });

  it("nunca devuelve menos de tres caracteres", () => {
    for (const nombre of ["A", "Ab", "El", "X Y", "Sol"]) {
      expect(siglaDe(nombre)).toHaveLength(3);
    }
  });

  it("cae en la sigla de la plataforma si el nombre no tiene letras", () => {
    expect(siglaDe("")).toBe(SIGLA_PLATAFORMA);
    expect(siglaDe("   ")).toBe(SIGLA_PLATAFORMA);
    expect(siglaDe("123 -- ///")).toBe(SIGLA_PLATAFORMA);
  });

  it("produce siempre una sigla que se considera válida", () => {
    for (const nombre of ["Parqueadero Centro Historico", "El Dorado", "A", ""]) {
      expect(esSiglaValida(siglaDe(nombre))).toBe(true);
    }
  });

  it("desempata alargando, sin volver la sigla irreconocible", () => {
    expect(siglaConDesempate("PCH", 1)).toBe("PCH");
    expect(siglaConDesempate("PCH", 2)).toBe("PCH2");
    expect(siglaConDesempate("PCH", 3)).toBe("PCH3");
    expect(esSiglaValida(siglaConDesempate("PCH", 12))).toBe(true);
  });
});

describe("código de cuenta", () => {
  it("junta la sigla con el correlativo", () => {
    expect(codigoDeCuenta("PCH", 1)).toBe("PCH-001");
    expect(codigoDeCuenta("PCH", 42)).toBe("PCH-042");
  });

  it("rellena con ceros para que el orden alfabético sea el de alta", () => {
    const codigos = [9, 10, 2].map((n) => codigoDeCuenta("PCH", n));
    expect([...codigos].sort()).toEqual(["PCH-002", "PCH-009", "PCH-010"]);
  });

  it("no se rompe cuando el correlativo pasa de tres cifras", () => {
    expect(codigoDeCuenta("PCH", 1000)).toBe("PCH-1000");
    expect(esCodigoDeCuentaValido(codigoDeCuenta("PCH", 1000))).toBe(true);
  });

  it("acepta los códigos que produce y rechaza los que no", () => {
    expect(esCodigoDeCuentaValido("PCH-001")).toBe(true);
    expect(esCodigoDeCuentaValido("PCH2-001")).toBe(true);
    expect(esCodigoDeCuentaValido("pch-001")).toBe(false);
    expect(esCodigoDeCuentaValido("PCH-1")).toBe(false);
    expect(esCodigoDeCuentaValido("PQV-A3F7K2")).toBe(false);
  });
});
