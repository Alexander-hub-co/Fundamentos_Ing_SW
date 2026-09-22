import { describe, expect, it } from "vitest";
import { calcularImporte, totalParcial } from "@/dominio/tarifas/calcular";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";
import type {
  TarifaPorIntervalo,
  TarifaPorMinuto,
  TarifaPrimeraHoraYFraccion,
} from "@/dominio/tarifas/modelos";

/**
 * Los ejemplos son los del propietario, con los números que él dio. Están acá
 * como prueba y no como comentario porque son el contrato del motor de cobro:
 * si alguno cambia, cambió cómo cobra el negocio y eso tiene que verse.
 *
 * Los importes concretos viven en las tarifas de cada caso, no en el código:
 * son datos de prueba, no valores del sistema.
 */

const en = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const LUNES = "2026-08-17";
const MARTES = "2026-08-18";

const H24: HorarioDelCobro = { abierto24h: true, franjas: [], cobraHorasCerradas: false };

/** Abre de 7:00 a 20:00 todos los días y no cobra lo cerrado. */
const DE_7_A_20: HorarioDelCobro = {
  abierto24h: false,
  franjas: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
    diaSemana,
    horaInicio: "07:00",
    horaFin: "20:00",
  })),
  cobraHorasCerradas: false,
};

const CARRO: TarifaPorMinuto = {
  modelo: "por_minuto",
  tarifaMinima: 500,
  valorMinuto: 60,
  tarifaPlena: 14_000,
  alcancePlena: "jornada",
};

const BICI: TarifaPorIntervalo = {
  modelo: "por_intervalo",
  intervaloMinutos: 30,
  valorIntervalo: 500,
  tarifaPlena: 4_000,
  alcancePlena: "jornada",
};

const minutosDespues = (n: number) => new Date(en(LUNES, "10:00").getTime() + n * 60_000);

function cobroDeCarro(minutos: number) {
  return calcularImporte({
    entrada: en(LUNES, "10:00"),
    salida: minutosDespues(minutos),
    tarifa: CARRO,
    horario: H24,
  });
}

describe("modelo por minuto — carros y motos", () => {
  it("cobra la mínima cuando el cálculo queda por debajo", () => {
    // 5 × $60 = $300, que es menos que la mínima de $500.
    const c = cobroDeCarro(5);
    expect(c.importe).toBe(500);
    expect(c.tope).toBe("minima");
  });

  it("cobra el cálculo directo entre ambos topes", () => {
    expect(cobroDeCarro(10).importe).toBe(600);
    expect(cobroDeCarro(60).importe).toBe(3_600);
    expect(cobroDeCarro(60).tope).toBe("ninguno");
  });

  it("cobra la plena cuando el cálculo la supera", () => {
    // 250 × $60 = $15.000, por encima de la plena de $14.000.
    const c = cobroDeCarro(250);
    expect(c.importe).toBe(14_000);
    expect(c.tope).toBe("plena");
  });

  it("cobra distinto a una moto con sus propios valores", () => {
    const moto: TarifaPorMinuto = { ...CARRO, valorMinuto: 40, tarifaPlena: 10_000 };
    const c = calcularImporte({
      entrada: en(LUNES, "10:00"),
      salida: minutosDespues(60),
      tarifa: moto,
      horario: H24,
    });

    expect(c.importe).toBe(2_400);
  });
});

describe("modelo por intervalos — bicicletas", () => {
  const cobro = (minutos: number) =>
    calcularImporte({
      entrada: en(LUNES, "10:00"),
      salida: minutosDespues(minutos),
      tarifa: BICI,
      horario: H24,
    });

  it("cualquier fracción cobra el intervalo entero", () => {
    expect(cobro(10).importe).toBe(500);
    expect(cobro(30).importe).toBe(500);
    expect(cobro(31).importe).toBe(1_000);
    expect(cobro(60).importe).toBe(1_000);
    expect(cobro(61).importe).toBe(1_500);
  });

  it("crece hasta la plena y ahí se detiene", () => {
    expect(cobro(240).importe).toBe(4_000);
    expect(cobro(300).importe).toBe(4_000);
    expect(cobro(420).importe).toBe(4_000);
    expect(cobro(300).tope).toBe("plena");
  });

  it("informa cuántos intervalos se cobraron", () => {
    expect(cobro(31).tramos[0]!.intervalos).toBe(2);
  });
});

describe("la jornada tarifaria", () => {
  it("no cobra las horas con el establecimiento cerrado", () => {
    // El caso completo del propietario: entra 19:30, sale 7:10 del día
    // siguiente. Primera jornada 19:30→20:00, la noche no se cobra, y la
    // jornada siguiente 7:00→7:10 son 10 minutos, un intervalo.
    const c = calcularImporte({
      entrada: en(LUNES, "19:30"),
      salida: en(MARTES, "07:10"),
      tarifa: BICI,
      horario: DE_7_A_20,
    });

    expect(c.tramos).toHaveLength(2);
    expect(c.tramos[0]!.importe).toBe(500); // 30 min → un intervalo
    expect(c.tramos[1]!.importe).toBe(500); // 10 min → un intervalo
    expect(c.importe).toBe(1_000);
  });

  it("aplica la plena a cada jornada por separado", () => {
    // Toda la jornada del lunes (7:00→20:00) alcanza la plena, y el martes
    // hasta las 7:10 cobra un intervalo.
    const c = calcularImporte({
      entrada: en(LUNES, "07:00"),
      salida: en(MARTES, "07:10"),
      tarifa: BICI,
      horario: DE_7_A_20,
    });

    expect(c.importe).toBe(4_500);
  });

  it("reinicia la jornada a medianoche en un establecimiento de 24 horas", () => {
    const c = calcularImporte({
      entrada: en(LUNES, "22:00"),
      salida: en(MARTES, "02:00"),
      tarifa: BICI,
      horario: H24,
    });

    expect(c.tramos).toHaveLength(2);
    // Dos horas en cada jornada: cuatro intervalos a $500 en cada una.
    expect(c.importe).toBe(2_000 + 2_000);
  });

  it("no cobra nada si entró y salió con el establecimiento cerrado", () => {
    const c = calcularImporte({
      entrada: en(LUNES, "21:00"),
      salida: en(LUNES, "23:00"),
      tarifa: BICI,
      horario: DE_7_A_20,
    });

    expect(c.tramos).toEqual([]);
    expect(c.importe).toBe(0);
  });
});

describe("el alcance de la plena y el cobro de horas cerradas son configurables", () => {
  it("con plena por estadía, tres días pagan una sola plena", () => {
    const porEstadia: TarifaPorMinuto = { ...CARRO, alcancePlena: "estadia" };
    const c = calcularImporte({
      entrada: en(LUNES, "10:00"),
      salida: new Date(en(LUNES, "10:00").getTime() + 3 * 24 * 3_600_000),
      tarifa: porEstadia,
      horario: H24,
    });

    expect(c.importe).toBe(14_000);
  });

  it("con plena por jornada, tres días pagan tres plenas", () => {
    const c = calcularImporte({
      entrada: en(LUNES, "00:00"),
      salida: new Date(en(LUNES, "00:00").getTime() + 3 * 24 * 3_600_000),
      tarifa: CARRO,
      horario: H24,
    });

    expect(c.importe).toBe(42_000);
  });

  it("dos establecimientos con decisiones opuestas cobran distinto lo mismo (SC-012)", () => {
    const cobrando: HorarioDelCobro = { ...DE_7_A_20, cobraHorasCerradas: true };

    const sinCobrar = calcularImporte({
      entrada: en(LUNES, "19:30"),
      salida: en(MARTES, "07:10"),
      tarifa: BICI,
      horario: DE_7_A_20,
    });
    const conCobro = calcularImporte({
      entrada: en(LUNES, "19:30"),
      salida: en(MARTES, "07:10"),
      tarifa: BICI,
      horario: cobrando,
    });

    expect(sinCobrar.importe).toBeLessThan(conCobro.importe);
  });
});

describe("el desglose justifica el importe (SC-014)", () => {
  it("los tramos suman el total cuando la plena es por jornada", () => {
    const c = calcularImporte({
      entrada: en(LUNES, "07:00"),
      salida: en(MARTES, "07:10"),
      tarifa: BICI,
      horario: DE_7_A_20,
    });

    expect(c.tramos.reduce((n, t) => n + t.importe, 0)).toBe(c.importe);
  });

  it("cada tramo dice cuántos minutos cubrió y qué tope se le aplicó", () => {
    const c = cobroDeCarro(250);
    expect(c.tramos[0]!.minutos).toBe(250);
    expect(c.tramos[0]!.tope).toBe("plena");
    expect(c.minutosTotales).toBe(250);
  });

  it("informa el tope aunque el importe venga de varios tramos", () => {
    const c = calcularImporte({
      entrada: en(LUNES, "07:00"),
      salida: en(MARTES, "07:10"),
      tarifa: BICI,
      horario: DE_7_A_20,
    });

    expect(c.tope).toBe("plena");
  });
});

describe("total parcial de un vehículo que sigue adentro", () => {
  it("es el mismo cálculo tomando el momento actual como salida", () => {
    const parcial = totalParcial({
      entrada: en(LUNES, "10:00"),
      ahora: minutosDespues(60),
      tarifa: CARRO,
      horario: H24,
    });

    expect(parcial.importe).toBe(cobroDeCarro(60).importe);
  });
});

describe("modelo de primera hora y fracción", () => {
  /**
   * Los valores salen de la pantalla 1b del rediseño: primera hora $1.400 y
   * bloques de 15 minutos a $700. Están acá porque ese desglose es el contrato
   * visible del modelo: si cambia, cambió cómo cobra el negocio.
   */
  const TARIFA: TarifaPrimeraHoraYFraccion = {
    modelo: "primera_hora_y_fraccion",
    valorPrimeraHora: 1_400,
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 20_000,
    alcancePlena: "jornada",
  };

  const cobro = (minutos: number) =>
    calcularImporte({
      entrada: en(LUNES, "10:32"),
      salida: new Date(en(LUNES, "10:32").getTime() + minutos * 60_000),
      tarifa: TARIFA,
      horario: H24,
    });

  it("reproduce el desglose de la pantalla 1b", () => {
    // 10:32 → 16:15 son 343 minutos: la primera hora $1.400, y los 283 que
    // sobran dan 19 bloques de 15 a $700, que son $13.300.
    const c = cobro(343);
    expect(c.importe).toBe(1_400 + 13_300);
    expect(c.importe).toBe(14_700);
    expect(c.tramos[0]!.intervalos).toBe(19);
  });

  it("cobra la primera hora entera aunque se vaya antes", () => {
    expect(cobro(10).importe).toBe(1_400);
    expect(cobro(60).importe).toBe(1_400);
  });

  it("el primer minuto pasado la hora ya cobra un bloque", () => {
    expect(cobro(61).importe).toBe(1_400 + 700);
    expect(cobro(75).importe).toBe(1_400 + 700);
    expect(cobro(76).importe).toBe(1_400 + 1_400);
  });

  it("respeta la plena como techo", () => {
    const c = calcularImporte({
      entrada: en(LUNES, "00:00"),
      salida: en(MARTES, "00:00"),
      tarifa: TARIFA,
      horario: H24,
    });
    expect(c.importe).toBe(20_000);
    expect(c.tope).toBe("plena");
  });

  it("convive con los otros dos sin tocarlos", () => {
    // El mismo tiempo, tres modelos, tres importes distintos: es lo que exige
    // el Principio II y lo que permite vender a locales que cobran distinto.
    const minutos = 343;
    const porMinuto = cobroDeCarro(minutos).importe;
    const primeraHora = cobro(minutos).importe;

    expect(porMinuto).not.toBe(primeraHora);
  });
});
