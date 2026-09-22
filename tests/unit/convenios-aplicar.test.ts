import { describe, expect, it } from "vitest";
import { aplicarConvenios } from "@/dominio/convenios/aplicar";
import type { ConvenioAplicable, TarifaAplicable } from "@/dominio/tarifas/modelos";

/**
 * El motor de convenios, entero, sin base de datos.
 *
 * Todo lo que hace falta —la permanencia, la tarifa, el horario, los convenios
 * y hasta cuántas veces se usó cada uno hoy— viaja como dato. Por eso estas
 * pruebas corren en milisegundos y cubren el cobro completo aunque no exista un
 * solo movimiento en el sistema.
 */

/** $700 cada 15 minutos, plena $18.000 por jornada. La del enunciado. */
const POR_INTERVALO: TarifaAplicable = {
  modelo: "por_intervalo",
  intervaloMinutos: 15,
  valorIntervalo: 700,
  tarifaPlena: 18_000,
  alcancePlena: "jornada",
};

const ABIERTO_24H = { abierto24h: true, franjas: [], cobraHorasCerradas: false };

const convenio = (p: Partial<ConvenioAplicable> & { beneficio: ConvenioAplicable["beneficio"] }): ConvenioAplicable => ({
  id: p.id ?? `c-${p.beneficio}-${p.valor ?? 0}`,
  nombre: p.nombre ?? "Convenio",
  activacion: p.activacion ?? "sello",
  valor: p.valor ?? null,
  topePesos: p.topePesos ?? null,
  limiteDiario: p.limiteDiario ?? null,
  aplicacionesPreviasHoy: p.aplicacionesPreviasHoy ?? 0,
  beneficio: p.beneficio,
});

const cobrar = (horas: number, convenios: ConvenioAplicable[], redondeo: "peso" | "cincuentena" | "centena" = "peso") =>
  aplicarConvenios({
    entrada: new Date(2026, 7, 19, 10, 0),
    salida: new Date(2026, 7, 19, 10 + horas, 0),
    tarifa: POR_INTERVALO,
    horario: ABIERTO_24H,
    convenios,
    redondeo,
  });

const FRUVER = convenio({ nombre: "Fruver", beneficio: "minutos_gratis", valor: 60 });
const CARNICERIA = convenio({ id: "carn", nombre: "Carnicería", beneficio: "minutos_gratis", valor: 30 });

describe("los minutos gratis salen del tiempo, no del importe", () => {
  it("una hora gratis sobre cinco horas cobra cuatro", () => {
    const sin = cobrar(5, []);
    const con = cobrar(5, [FRUVER]);

    // 5 h = 20 intervalos = $14.000. 4 h = 16 intervalos = $11.200.
    expect(sin.importe).toBe(14_000);
    expect(con.importe).toBe(11_200);
    expect(con.importeBase).toBe(14_000);
  });

  it("el desglose dice cuántos minutos había antes y cuántos se regalaron", () => {
    const c = cobrar(5, [FRUVER]);
    expect(c.minutosBase).toBe(300);
    expect(c.minutosRegalados).toBe(60);
    expect(c.minutosTotales).toBe(240);
  });

  it("dos sellos a la vez suman sus minutos", () => {
    // El cliente compró en el fruver y en la carnicería: 60 + 30 = 90 minutos.
    const c = cobrar(5, [FRUVER, CARNICERIA]);
    expect(c.minutosRegalados).toBe(90);
    // 3 h 30 = 14 intervalos = $9.800.
    expect(c.importe).toBe(9_800);
  });

  it("cada convenio aparece con su aporte por separado", () => {
    const c = cobrar(5, [FRUVER, CARNICERIA]);
    const porNombre = Object.fromEntries(c.beneficios.map((b) => [b.nombre, b.descontado]));
    expect(porNombre["Fruver"]! + porNombre["Carnicería"]!).toBe(14_000 - 9_800);
  });
});

describe("nunca hay saldo a favor", () => {
  it("40 minutos de permanencia con 60 gratis dan cero", () => {
    const c = aplicarConvenios({
      entrada: new Date(2026, 7, 19, 10, 0),
      salida: new Date(2026, 7, 19, 10, 40),
      tarifa: POR_INTERVALO,
      horario: ABIERTO_24H,
      convenios: [FRUVER],
      redondeo: "peso",
    });
    expect(c.importe).toBe(0);
  });

  it("ni con tres convenios de una hora cada uno", () => {
    const tres = [1, 2, 3].map((n) =>
      convenio({ id: `h${n}`, nombre: `Hora ${n}`, beneficio: "minutos_gratis", valor: 60 }),
    );
    expect(cobrar(1, tres).importe).toBe(0);
  });
});

describe("los porcentajes se suman, no se encadenan", () => {
  const mitad = convenio({ id: "p50", nombre: "Mitad", activacion: "placa", beneficio: "porcentaje", valor: 50 });
  const veinte = convenio({ id: "p20", nombre: "Veinte", beneficio: "porcentaje", valor: 20 });

  it("50 % y 20 % descuentan el 70 %, no el 60 %", () => {
    const c = cobrar(5, [mitad, veinte]);
    // Encadenar daría 14.000 × 0,5 × 0,8 = 5.600. Sumar da 14.000 × 0,3 = 4.200.
    expect(c.importe).toBe(4_200);
  });

  it("tres del 40 % se acotan al 100 %, no al 120 %", () => {
    const tres = [1, 2, 3].map((n) =>
      convenio({ id: `q${n}`, nombre: `Cuarenta ${n}`, beneficio: "porcentaje", valor: 40 }),
    );
    const c = cobrar(5, tres);
    expect(c.importe).toBe(0);
    expect(c.sumaPorcentajesAcotada).toBe(true);
  });

  it("sin pasarse de cien, no se acota nada", () => {
    expect(cobrar(5, [mitad, veinte]).sumaPorcentajesAcotada).toBe(false);
  });
});

describe("el límite diario", () => {
  const unaVez = convenio({
    id: "lim", nombre: "Una vez", beneficio: "minutos_gratis", valor: 60, limiteDiario: 1,
  });

  it("con cero usos previos sí se aplica", () => {
    expect(cobrar(5, [{ ...unaVez, aplicacionesPreviasHoy: 0 }]).importe).toBe(11_200);
  });

  it("alcanzado el límite no se aplica, y el desglose dice por qué", () => {
    const c = cobrar(5, [{ ...unaVez, aplicacionesPreviasHoy: 1 }]);
    expect(c.importe).toBe(14_000);
    expect(c.beneficios[0]!.noAplicado).toBe("limite_diario");
  });

  it("sin límite declarado se aplica siempre", () => {
    const sinLimite = { ...unaVez, limiteDiario: null, aplicacionesPreviasHoy: 99 };
    expect(cobrar(5, [sinLimite]).importe).toBe(11_200);
  });
});

describe("el tope en pesos recorta el aporte de su convenio", () => {
  it("un tope menor que el descuento lo limita, y queda dicho", () => {
    const conTope = convenio({
      id: "t", nombre: "Con tope", activacion: "placa", beneficio: "porcentaje",
      valor: 50, topePesos: 5_000,
    });
    const c = cobrar(5, [conTope]);
    // El 50 % de 14.000 son 7.000, pero el tope deja 5.000.
    expect(c.importe).toBe(9_000);
    expect(c.beneficios[0]!.recortadoPorTope).toBe(true);
  });

  it("un tope mayor que el descuento no cambia nada", () => {
    const conTope = convenio({
      id: "t2", nombre: "Tope alto", activacion: "placa", beneficio: "porcentaje",
      valor: 50, topePesos: 50_000,
    });
    const c = cobrar(5, [conTope]);
    expect(c.importe).toBe(7_000);
    expect(c.beneficios[0]!.recortadoPorTope).toBe(false);
  });
});

describe("la tarifa fija y el sin cobro determinan el total solos", () => {
  it("el sin cobro deja el total en cero y desplaza a los demás", () => {
    const mensualidad = convenio({ id: "m", nombre: "Mensualidad", activacion: "placa", beneficio: "sin_cobro" });
    const c = cobrar(5, [mensualidad, FRUVER]);

    expect(c.importe).toBe(0);
    const fruver = c.beneficios.find((b) => b.nombre === "Fruver");
    expect(fruver!.noAplicado).toBe("desplazado");
  });

  it("la tarifa fija manda sobre los minutos gratis", () => {
    const fija = convenio({ id: "f", nombre: "Fija", beneficio: "tarifa_fija", valor: 8_000 });
    const c = cobrar(5, [fija, FRUVER]);

    expect(c.importe).toBe(8_000);
    expect(c.beneficios.find((b) => b.nombre === "Fruver")!.noAplicado).toBe("desplazado");
  });

  it("entre dos determinantes gana el más favorable al cliente", () => {
    const cara = convenio({ id: "f1", nombre: "Fija cara", beneficio: "tarifa_fija", valor: 8_000 });
    const barata = convenio({ id: "f2", nombre: "Fija barata", beneficio: "tarifa_fija", valor: 3_000 });
    expect(cobrar(5, [cara, barata]).importe).toBe(3_000);
  });
});

describe("el redondeo nunca sube el total", () => {
  const mitad = convenio({ id: "p50", nombre: "Mitad", activacion: "placa", beneficio: "porcentaje", valor: 50 });

  it("a la centena baja, aunque el más cercano fuera hacia arriba", () => {
    // 14.000 − 50 % = 7.000. Con 3 h: 12 intervalos = 8.400; la mitad, 4.200.
    // Se usa una cifra quebrada a propósito.
    const quebrado = cobrar(5, [convenio({ id: "p33", nombre: "Un tercio", beneficio: "porcentaje", valor: 33 })], "centena");
    expect(quebrado.importe % 100).toBe(0);
    expect(quebrado.importe).toBeLessThanOrEqual(14_000 - Math.round(14_000 * 0.33));
  });

  it("ninguna regla produce un total mayor que la tarifa sola", () => {
    for (const regla of ["peso", "cincuentena", "centena"] as const) {
      for (const horas of [1, 3, 7]) {
        const c = cobrar(horas, [mitad], regla);
        expect(c.importe).toBeLessThanOrEqual(c.importeBase);
      }
    }
  });
});

describe("el mismo cálculo da siempre el mismo resultado", () => {
  it("repetido cien veces con la misma entrada", () => {
    const convenios = [FRUVER, convenio({ id: "p", nombre: "Pct", beneficio: "porcentaje", valor: 20 })];
    const primero = cobrar(5, convenios).importe;
    for (let i = 0; i < 100; i++) expect(cobrar(5, convenios).importe).toBe(primero);
  });

  it("y ninguna combinación supera lo que cobraría la tarifa sola", () => {
    const piezas = [FRUVER, CARNICERIA,
      convenio({ id: "p10", nombre: "Diez", beneficio: "porcentaje", valor: 10 }),
      convenio({ id: "p90", nombre: "Noventa", beneficio: "porcentaje", valor: 90 })];

    for (let mascara = 0; mascara < 16; mascara++) {
      const activos = piezas.filter((_, i) => (mascara >> i) & 1);
      const c = cobrar(6, activos);
      expect(c.importe).toBeGreaterThanOrEqual(0);
      expect(c.importe).toBeLessThanOrEqual(c.importeBase);
    }
  });
});

describe("el sello cubre también la tarifa mínima", () => {
  /**
   * La tarifa colombiana típica de carro: por minuto, con un piso.
   *
   * El piso existe para que una estadía de tres minutos no cueste ciento
   * ochenta pesos. Pero cuando un convenio regala más tiempo del que el
   * vehículo estuvo, no hay nada que cobrar Y TAMPOCO HAY PISO: la mínima es el
   * mínimo de un cobro, no un cargo por existir.
   */
  const POR_MINUTO: TarifaAplicable = {
    modelo: "por_minuto",
    valorMinuto: 60,
    tarifaMinima: 500,
    tarifaPlena: 13_000,
    alcancePlena: "jornada",
  };

  const conMinima = (minutos: number, convenios: ConvenioAplicable[]) =>
    aplicarConvenios({
      entrada: new Date(2026, 7, 20, 10, 0),
      salida: new Date(2026, 7, 20, 10, minutos),
      tarifa: POR_MINUTO,
      horario: ABIERTO_24H,
      convenios,
      redondeo: "peso",
    });

  it("sin sello, una estadía corta paga la mínima", () => {
    // El comportamiento normal, que sigue valiendo.
    expect(conMinima(5, []).importe).toBe(500);
  });

  it("con sello de una hora y cinco minutos adentro, se cobra CERO", () => {
    // El caso que reportó el propietario del producto: el sello cubre el 100 %
    // y la mínima no puede reaparecer por debajo.
    expect(conMinima(5, [FRUVER]).importe).toBe(0);
  });

  it("con sello de una hora y cuarenta y cinco minutos adentro, también cero", () => {
    expect(conMinima(45, [FRUVER]).importe).toBe(0);
  });

  it("pasada la hora regalada, se cobra sólo el excedente", () => {
    // 90 minutos con 60 gratis: se cobran 30 a sesenta pesos.
    expect(conMinima(90, [FRUVER]).importe).toBe(1_800);
  });

  it("y el excedente corto SÍ vuelve a tener piso", () => {
    // 62 minutos con 60 gratis dejan 2 minutos = 120 pesos, por debajo del
    // piso. Acá la mínima sí corresponde: hubo cobro, y el cobro tiene suelo.
    expect(conMinima(62, [FRUVER]).importe).toBe(500);
  });
});
