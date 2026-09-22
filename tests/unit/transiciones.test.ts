import { describe, expect, it } from "vitest";
import {
  TransicionInvalida,
  esOperativo,
  esRestringido,
  esTerminal,
  exigirTransicion,
  puedeTransicionar,
  transicionesPosibles,
} from "@/dominio/parqueaderos/estados";
import type { EstadoParqueadero } from "@/db/esquema";

/**
 * V10 — Toda transición no contemplada es rechazada (FR-023).
 *
 * Se recorre la matriz COMPLETA de 4×4 en vez de probar casos sueltos: así, si
 * alguien añade un estado o cambia una regla, esta prueba lo nota sin que haya
 * que acordarse de agregar el caso.
 */

const ESTADOS: EstadoParqueadero[] = [
  "activo",
  "pendiente",
  "suspendido",
  "dado_de_baja",
];

/** La matriz esperada, escrita a mano y a propósito. */
const ESPERADAS: Record<EstadoParqueadero, EstadoParqueadero[]> = {
  activo: ["pendiente", "suspendido", "dado_de_baja"],
  pendiente: ["activo", "suspendido", "dado_de_baja"],
  suspendido: ["activo", "pendiente", "dado_de_baja"],
  dado_de_baja: ["activo"],
};

describe("matriz completa de transiciones", () => {
  it.each(ESTADOS)("desde %s se permiten exactamente las esperadas", (desde) => {
    expect([...transicionesPosibles(desde)].sort()).toEqual(
      [...ESPERADAS[desde]].sort(),
    );
  });

  it("las 16 combinaciones se comportan según la matriz", () => {
    const inesperadas: string[] = [];

    for (const desde of ESTADOS) {
      for (const hacia of ESTADOS) {
        const permitida = ESPERADAS[desde].includes(hacia);
        if (puedeTransicionar(desde, hacia) !== permitida) {
          inesperadas.push(`${desde} → ${hacia}`);
        }
      }
    }

    expect(inesperadas).toEqual([]);
  });

  it("ningún estado puede transicionar a sí mismo", () => {
    for (const estado of ESTADOS) {
      expect(puedeTransicionar(estado, estado)).toBe(false);
    }
  });

  it("exigirTransicion lanza en toda combinación no permitida", () => {
    for (const desde of ESTADOS) {
      for (const hacia of ESTADOS) {
        if (ESPERADAS[desde].includes(hacia)) continue;
        expect(() => exigirTransicion(desde, hacia)).toThrow(TransicionInvalida);
      }
    }
  });

  it("el mensaje distingue 'ya está en ese estado' de una transición prohibida", () => {
    expect(() => exigirTransicion("activo", "activo")).toThrow(/ya está/);
    expect(() => exigirTransicion("dado_de_baja", "suspendido")).toThrow(/No se puede/);
  });
});

describe("dado de baja es terminal", () => {
  it("su única salida es la reactivación explícita a activo (FR-041)", () => {
    expect(transicionesPosibles("dado_de_baja")).toEqual(["activo"]);
  });

  it("no se puede pasar de dado de baja a suspendido ni a pendiente", () => {
    expect(puedeTransicionar("dado_de_baja", "suspendido")).toBe(false);
    expect(puedeTransicionar("dado_de_baja", "pendiente")).toBe(false);
  });
});

describe("clasificación de estados", () => {
  it("activo y pendiente operan; los otros dos no (FR-024)", () => {
    expect(esOperativo("activo")).toBe(true);
    expect(esOperativo("pendiente")).toBe(true);
    expect(esOperativo("suspendido")).toBe(false);
    expect(esOperativo("dado_de_baja")).toBe(false);
  });

  it("sólo suspendido es modo restringido", () => {
    expect(ESTADOS.filter(esRestringido)).toEqual(["suspendido"]);
  });

  it("sólo dado de baja es terminal", () => {
    expect(ESTADOS.filter(esTerminal)).toEqual(["dado_de_baja"]);
  });

  it("las tres clasificaciones son mutuamente excluyentes", () => {
    for (const estado of ESTADOS) {
      const cuantas = [
        esOperativo(estado),
        esRestringido(estado),
        esTerminal(estado),
      ].filter(Boolean).length;
      expect(cuantas, `${estado} cae en ${cuantas} clasificaciones`).toBe(1);
    }
  });
});
