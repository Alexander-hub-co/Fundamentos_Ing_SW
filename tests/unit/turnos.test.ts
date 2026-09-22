import { describe, expect, it } from "vitest";
import { turnosVigentesEn, type TurnoCompleto } from "@/dominio/turnos/consultar";
import { horasSinCubrir } from "@/dominio/turnos/cobertura";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";

const en = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const LUNES = "2026-08-17";
const MARTES = "2026-08-18";
const DOMINGO = "2026-08-16";

const turno = (p: Partial<TurnoCompleto> & { nombre: string }): TurnoCompleto => ({
  id: p.nombre,
  horaInicio: "07:00",
  horaFin: "15:00",
  activo: true,
  dias: [1, 2, 3, 4, 5],
  personas: [{ id: "u1", nombre: "Persona", codigo: "PCH-001" }],
  ...p,
});

describe("qué turno rige en un momento", () => {
  const manana = turno({ nombre: "Mañana", horaInicio: "07:00", horaFin: "15:00" });
  const tarde = turno({ nombre: "Tarde", horaInicio: "15:00", horaFin: "20:00" });
  const nocturno = turno({ nombre: "Nocturno", horaInicio: "22:00", horaFin: "06:00", dias: [1] });

  it("devuelve el turno que cubre ese instante", () => {
    const v = turnosVigentesEn([manana, tarde], en(LUNES, "16:00"));
    expect(v.map((t) => t.nombre)).toEqual(["Tarde"]);
  });

  it("un turno nocturno sigue vigente de madrugada del día siguiente", () => {
    // El caso que se equivoca solo: a las 02:00 del martes rige el que arrancó
    // el lunes a las 22:00.
    expect(turnosVigentesEn([nocturno], en(MARTES, "02:00")).map((t) => t.nombre)).toEqual([
      "Nocturno",
    ]);
    expect(turnosVigentesEn([nocturno], en(MARTES, "07:00"))).toEqual([]);
  });

  it("un día sin turno no devuelve ninguno", () => {
    expect(turnosVigentesEn([manana, tarde], en(DOMINGO, "10:00"))).toEqual([]);
  });

  it("un turno inactivo no rige aunque su horario coincida", () => {
    const apagado = turno({ nombre: "Apagado", activo: false });
    expect(turnosVigentesEn([apagado], en(LUNES, "10:00"))).toEqual([]);
  });

  it("dos turnos solapados devuelven los dos: es configuración legítima", () => {
    const refuerzo = turno({ nombre: "Refuerzo", horaInicio: "12:00", horaFin: "18:00" });
    const v = turnosVigentesEn([manana, refuerzo], en(LUNES, "13:00"));
    expect(v.map((t) => t.nombre).sort()).toEqual(["Mañana", "Refuerzo"]);
  });
});

describe("horas de atención sin cubrir", () => {
  const abre7a20: HorarioDelCobro = {
    abierto24h: false,
    franjas: [{ diaSemana: 1, horaInicio: "07:00", horaFin: "20:00" }],
    cobraHorasCerradas: false,
  };
  const desde = en(LUNES, "00:00");
  const hasta = en(MARTES, "00:00");

  it("no avisa nada cuando los turnos cubren todo", () => {
    const cubren = [
      turno({ nombre: "M", horaInicio: "07:00", horaFin: "14:00", dias: [1] }),
      turno({ nombre: "T", horaInicio: "14:00", horaFin: "20:00", dias: [1] }),
    ];
    expect(horasSinCubrir(abre7a20, cubren, desde, hasta)).toEqual([]);
  });

  it("señala el hueco cuando falta cubrir el final del día", () => {
    const solo = [turno({ nombre: "M", horaInicio: "07:00", horaFin: "14:00", dias: [1] })];
    const huecos = horasSinCubrir(abre7a20, solo, desde, hasta);

    expect(huecos).toHaveLength(1);
    expect(huecos[0]!.desde).toEqual(en(LUNES, "14:00"));
    expect(huecos[0]!.hasta).toEqual(en(LUNES, "20:00"));
  });

  it("señala la franja entera cuando no hay ningún turno", () => {
    const huecos = horasSinCubrir(abre7a20, [], desde, hasta);
    expect(huecos).toHaveLength(1);
    expect(huecos[0]!.desde).toEqual(en(LUNES, "07:00"));
  });

  it("un turno sin nadie asignado no cuenta como cobertura", () => {
    const vacio = [turno({ nombre: "M", horaInicio: "07:00", horaFin: "20:00", dias: [1], personas: [] })];
    expect(horasSinCubrir(abre7a20, vacio, desde, hasta)).toHaveLength(1);
  });

  it("un turno que se extiende fuera del horario no genera aviso", () => {
    // Alguien entra media hora antes a abrir y contar la caja: es normal.
    const largo = [turno({ nombre: "M", horaInicio: "06:30", horaFin: "20:30", dias: [1] })];
    expect(horasSinCubrir(abre7a20, largo, desde, hasta)).toEqual([]);
  });

  it("no avisa nada en un establecimiento de 24 horas", () => {
    const h24: HorarioDelCobro = { abierto24h: true, franjas: [], cobraHorasCerradas: false };
    expect(horasSinCubrir(h24, [], desde, hasta)).toEqual([]);
  });
});
