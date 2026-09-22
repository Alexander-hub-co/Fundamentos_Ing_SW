import { describe, expect, it } from "vitest";
import {
  expandirHorario,
  intersecar,
  minutosDe,
  minutosDelDia,
  partirPorDia,
  type ReglaHoraria,
} from "@/dominio/calendario/expandir";

/**
 * El calendario es la pieza de más riesgo de F2: convierte reglas de reloj en
 * instantes absolutos, y es donde este tipo de sistema falla más seguido. Lo
 * que se prueba acá son los casos que se equivocan solos —cruces de medianoche,
 * días sin regla, rangos de varios días—, no el camino feliz.
 *
 * Todas las fechas se escriben con desfase explícito `-05:00` para no depender
 * de la zona del servidor que corra las pruebas.
 */

const LUNES = "2026-08-17"; // lunes
const en = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);

const deLunesAViernes = (horaInicio: string, horaFin: string): ReglaHoraria[] =>
  [1, 2, 3, 4, 5].map((diaSemana) => ({ diaSemana, horaInicio, horaFin }));

describe("minutosDelDia", () => {
  it("convierte la hora del reloj a minutos", () => {
    expect(minutosDelDia("00:00")).toBe(0);
    expect(minutosDelDia("07:30")).toBe(450);
    expect(minutosDelDia("23:59")).toBe(1439);
    expect(minutosDelDia("20:00:00")).toBe(1200);
  });
});

describe("expandirHorario", () => {
  it("no inventa ventanas cuando no hay reglas", () => {
    expect(expandirHorario([], en(LUNES, "00:00"), en(LUNES, "23:59"))).toEqual([]);
  });

  it("expande un horario normal al día que corresponde", () => {
    const v = expandirHorario(
      deLunesAViernes("07:00", "20:00"),
      en(LUNES, "00:00"),
      en(LUNES, "23:59"),
    );

    expect(v).toHaveLength(1);
    expect(v[0]!.desde).toEqual(en(LUNES, "07:00"));
    expect(v[0]!.hasta).toEqual(en(LUNES, "20:00"));
  });

  it("no devuelve ventana en un día sin regla", () => {
    const domingo = "2026-08-16";
    const v = expandirHorario(
      deLunesAViernes("07:00", "20:00"),
      en(domingo, "00:00"),
      en(domingo, "23:59"),
    );

    expect(v).toEqual([]);
  });

  it("entiende una regla que cruza la medianoche", () => {
    const v = expandirHorario(
      [{ diaSemana: 1, horaInicio: "20:00", horaFin: "06:00" }],
      en(LUNES, "00:00"),
      en("2026-08-18", "23:59"),
    );

    expect(v).toHaveLength(1);
    expect(v[0]!.desde).toEqual(en(LUNES, "20:00"));
    expect(v[0]!.hasta).toEqual(en("2026-08-18", "06:00"));
  });

  it("encuentra la regla del día ANTERIOR que sigue vigente de madrugada", () => {
    // Es el error clásico: a las 02:00 del martes parece que no hay nada
    // abierto, cuando el nocturno del lunes sigue corriendo.
    const v = expandirHorario(
      [{ diaSemana: 1, horaInicio: "22:00", horaFin: "06:00" }],
      en("2026-08-18", "02:00"),
      en("2026-08-18", "03:00"),
    );

    expect(v).toHaveLength(1);
    expect(v[0]!.desde).toEqual(en(LUNES, "22:00"));
  });

  it("devuelve una ventana por día en un rango de varios días", () => {
    const v = expandirHorario(
      deLunesAViernes("07:00", "20:00"),
      en(LUNES, "00:00"),
      en("2026-08-20", "23:59"),
    );

    expect(v).toHaveLength(4); // lunes a jueves
    expect(v.map((x) => x.desde.getTime())).toEqual(
      [...v].sort((a, b) => a.desde.getTime() - b.desde.getTime()).map((x) => x.desde.getTime()),
    );
  });

  it("admite varias franjas en un mismo día", () => {
    const v = expandirHorario(
      [
        { diaSemana: 1, horaInicio: "07:00", horaFin: "12:00" },
        { diaSemana: 1, horaInicio: "14:00", horaFin: "20:00" },
      ],
      en(LUNES, "00:00"),
      en(LUNES, "23:59"),
    );

    expect(v).toHaveLength(2);
    expect(v[0]!.hasta).toEqual(en(LUNES, "12:00"));
    expect(v[1]!.desde).toEqual(en(LUNES, "14:00"));
  });
});

describe("partirPorDia", () => {
  it("no parte nada cuando el rango está vacío", () => {
    expect(partirPorDia(en(LUNES, "10:00"), en(LUNES, "10:00"))).toEqual([]);
  });

  it("deja un solo tramo cuando todo cae en el mismo día", () => {
    const t = partirPorDia(en(LUNES, "10:00"), en(LUNES, "18:00"));
    expect(t).toHaveLength(1);
  });

  it("corta en la medianoche local", () => {
    const t = partirPorDia(en(LUNES, "22:00"), en("2026-08-18", "02:00"));

    expect(t).toHaveLength(2);
    expect(t[0]!.hasta).toEqual(en("2026-08-18", "00:00"));
    expect(t[1]!.desde).toEqual(en("2026-08-18", "00:00"));
  });

  it("parte una permanencia de varios días en un tramo por día", () => {
    const t = partirPorDia(en(LUNES, "22:00"), en("2026-08-20", "02:00"));
    expect(t).toHaveLength(4);
  });
});

describe("intersecar y minutosDe", () => {
  it("devuelve null cuando las ventanas no se tocan", () => {
    const a = { desde: en(LUNES, "07:00"), hasta: en(LUNES, "12:00") };
    const b = { desde: en(LUNES, "14:00"), hasta: en(LUNES, "20:00") };
    expect(intersecar(a, b)).toBeNull();
  });

  it("devuelve null cuando sólo se tocan en el borde", () => {
    const a = { desde: en(LUNES, "07:00"), hasta: en(LUNES, "12:00") };
    const b = { desde: en(LUNES, "12:00"), hasta: en(LUNES, "20:00") };
    expect(intersecar(a, b)).toBeNull();
  });

  it("recorta a la parte común", () => {
    const a = { desde: en(LUNES, "07:00"), hasta: en(LUNES, "20:00") };
    const b = { desde: en(LUNES, "18:00"), hasta: en("2026-08-18", "06:00") };
    const c = intersecar(a, b)!;

    expect(c.desde).toEqual(en(LUNES, "18:00"));
    expect(c.hasta).toEqual(en(LUNES, "20:00"));
  });

  it("cuenta los minutos redondeando hacia arriba", () => {
    expect(minutosDe({ desde: en(LUNES, "10:00"), hasta: en(LUNES, "11:00") })).toBe(60);
    expect(
      minutosDe({
        desde: new Date("2026-08-17T10:00:00-05:00"),
        hasta: new Date("2026-08-17T10:00:30-05:00"),
      }),
    ).toBe(1);
  });
});
