import { describe, expect, it } from "vitest";
import { estaAbierto } from "@/dominio/horarios/consultar";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";

/** El horario ya no es informativo: la jornada tarifaria se apoya en él. */

const en = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const LUNES = "2026-08-17";
const DOMINGO = "2026-08-16";
const MARTES = "2026-08-18";

const H24: HorarioDelCobro = { abierto24h: true, franjas: [], cobraHorasCerradas: false };

const LUN_A_VIE: HorarioDelCobro = {
  abierto24h: false,
  franjas: [1, 2, 3, 4, 5].map((diaSemana) => ({
    diaSemana,
    horaInicio: "07:00",
    horaFin: "19:00",
  })),
  cobraHorasCerradas: false,
};

const NOCTURNO: HorarioDelCobro = {
  abierto24h: false,
  franjas: [{ diaSemana: 1, horaInicio: "20:00", horaFin: "06:00" }],
  cobraHorasCerradas: false,
};

describe("estaAbierto", () => {
  it("un establecimiento de 24 horas está abierto siempre", () => {
    expect(estaAbierto(H24, en(DOMINGO, "03:00"))).toBe(true);
  });

  it("dentro del horario está abierto", () => {
    expect(estaAbierto(LUN_A_VIE, en(LUNES, "10:00"))).toBe(true);
  });

  it("fuera del horario está cerrado", () => {
    expect(estaAbierto(LUN_A_VIE, en(LUNES, "06:00"))).toBe(false);
    expect(estaAbierto(LUN_A_VIE, en(LUNES, "20:00"))).toBe(false);
  });

  it("un día sin franja está cerrado", () => {
    expect(estaAbierto(LUN_A_VIE, en(DOMINGO, "10:00"))).toBe(false);
  });

  it("justo en la apertura está abierto y justo en el cierre ya no", () => {
    expect(estaAbierto(LUN_A_VIE, en(LUNES, "07:00"))).toBe(true);
    expect(estaAbierto(LUN_A_VIE, en(LUNES, "19:00"))).toBe(false);
  });

  it("un horario que cruza la medianoche sigue abierto de madrugada", () => {
    // Es el caso que se equivoca solo: a las 02:00 del martes rige la franja
    // que arrancó el lunes a las 20:00.
    expect(estaAbierto(NOCTURNO, en(LUNES, "22:00"))).toBe(true);
    expect(estaAbierto(NOCTURNO, en(MARTES, "02:00"))).toBe(true);
    expect(estaAbierto(NOCTURNO, en(MARTES, "07:00"))).toBe(false);
  });
});
