import { describe, expect, it } from "vitest";
import { demoraPara, esperaRestante } from "@/dominio/autenticacion/demora";
import {
  DEMORA_MAXIMA_MS,
  INTENTOS_SIN_PENALIZACION,
} from "@/dominio/autenticacion/parametros";

/**
 * La curva de la demora progresiva, probada como función pura.
 *
 * Sin base de datos ni relojes falsos: lo que se verifica acá es la forma de la
 * curva, y sobre todo que tenga tope — que es lo que garantiza FR-007.
 */

describe("los primeros intentos no tienen penalización", () => {
  it.each([0, 1, 2, 3])("con %i fallos la espera es cero", (fallos) => {
    expect(demoraPara(fallos)).toBe(0);
  });

  it("el umbral coincide con el parámetro declarado", () => {
    expect(demoraPara(INTENTOS_SIN_PENALIZACION)).toBe(0);
    expect(demoraPara(INTENTOS_SIN_PENALIZACION + 1)).toBeGreaterThan(0);
  });
});

describe("la espera se duplica a partir del cuarto fallo (FR-006)", () => {
  it.each([
    [4, 2_000],
    [5, 4_000],
    [6, 8_000],
    [7, 16_000],
  ])("con %i fallos espera %i ms", (fallos, esperado) => {
    expect(demoraPara(fallos)).toBe(esperado);
  });
});

describe("el tope es lo que impide el bloqueo permanente (FR-007)", () => {
  it("a partir del octavo fallo se queda en 30 segundos", () => {
    expect(demoraPara(8)).toBe(DEMORA_MAXIMA_MS);
  });

  it("por muchos fallos que se acumulen, nunca supera el tope", () => {
    for (const fallos of [10, 50, 100, 1_000]) {
      expect(demoraPara(fallos)).toBe(DEMORA_MAXIMA_MS);
    }
  });

  it("con el tope, un ataque no consigue más de 2 intentos por minuto (SC-010)", () => {
    const intentosPorMinuto = 60_000 / DEMORA_MAXIMA_MS;
    expect(intentosPorMinuto).toBeLessThanOrEqual(2);
  });

  it("la espera máxima es tolerable para una persona: medio minuto", () => {
    expect(DEMORA_MAXIMA_MS / 1000).toBeLessThanOrEqual(30);
  });
});

describe("la cuenta atrás corre desde el último fallo", () => {
  const ahora = new Date("2026-08-16T12:00:00Z");

  it("sin fallos previos no hay espera", () => {
    expect(esperaRestante(0, null, ahora)).toBe(0);
  });

  it("recién ocurrido el fallo, hay que esperar la demora completa", () => {
    const ultimo = new Date(ahora.getTime());
    expect(esperaRestante(4, ultimo, ahora)).toBe(2_000);
  });

  it("transcurrida la mitad, resta la mitad", () => {
    const ultimo = new Date(ahora.getTime() - 1_000);
    expect(esperaRestante(4, ultimo, ahora)).toBe(1_000);
  });

  it("transcurrida la espera, se puede reintentar", () => {
    const ultimo = new Date(ahora.getTime() - 5_000);
    expect(esperaRestante(4, ultimo, ahora)).toBe(0);
  });

  it("tras el tope, esperar 30 segundos siempre alcanza", () => {
    const ultimo = new Date(ahora.getTime() - DEMORA_MAXIMA_MS);
    expect(esperaRestante(1_000, ultimo, ahora)).toBe(0);
  });
});
