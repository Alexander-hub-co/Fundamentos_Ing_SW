import { describe, expect, it } from "vitest";
import { describirHorario } from "@/dominio/parqueaderos/configuracion-resumen";

/**
 * El resumen de horario que ve el administrador general en la ficha de un
 * establecimiento. Es una frase corta y por eso mismo peligrosa: cuanto más
 * resume, más fácil es que diga algo que no es.
 */

const franja = (diaSemana: number, horaInicio = "07:00:00", horaFin = "20:00:00") => ({
  diaSemana,
  horaInicio,
  horaFin,
});

describe("resumen del horario", () => {
  it("dice 24 horas sin mirar las franjas", () => {
    expect(describirHorario({ abierto24h: true, franjas: [], cobraHorasCerradas: false })).toBe(
      "Abierto 24 horas",
    );
  });

  it("distingue no haber declarado horario de estar cerrado", () => {
    expect(describirHorario({ abierto24h: false, franjas: [], cobraHorasCerradas: false })).toBe(
      "Sin declarar",
    );
  });

  it("resume un tramo corrido y recorta los segundos de la hora", () => {
    const franjas = [1, 2, 3, 4, 5, 6].map((d) => franja(d));
    expect(describirHorario({ abierto24h: false, franjas, cobraHorasCerradas: false })).toBe(
      "07:00–20:00, lun a sáb",
    );
  });

  it("NO dice 'lun a vie' cuando falta un día en el medio", () => {
    // El caso que motiva la comprobación: con miércoles cerrado, "lun a vie"
    // sería información falsa. Se enumeran los días que sí abre.
    const franjas = [1, 2, 4, 5].map((d) => franja(d));
    expect(describirHorario({ abierto24h: false, franjas, cobraHorasCerradas: false })).toBe(
      "07:00–20:00, lun, mar, jue, vie",
    );
  });

  it("no inventa una hora única cuando los días no coinciden", () => {
    const franjas = [franja(1), franja(6, "09:00:00", "14:00:00")];
    expect(describirHorario({ abierto24h: false, franjas, cobraHorasCerradas: false })).toBe(
      "Propio, lun, sáb",
    );
  });

  it("dice 'todos los días' con la semana completa", () => {
    const franjas = [0, 1, 2, 3, 4, 5, 6].map((d) => franja(d));
    expect(describirHorario({ abierto24h: false, franjas, cobraHorasCerradas: false })).toBe(
      "07:00–20:00, todos los días",
    );
  });

  it("un solo día se nombra, no se convierte en un rango", () => {
    expect(
      describirHorario({ abierto24h: false, franjas: [franja(0)], cobraHorasCerradas: false }),
    ).toBe("07:00–20:00, dom");
  });
});
