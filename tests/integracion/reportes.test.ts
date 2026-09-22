import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { registrarEntrada, registrarSalida } from "@/dominio/taquilla/registrar";
import { emitirCorreccion } from "@/dominio/correcciones/emitir";
import { reporteDelEstablecimiento } from "@/dominio/reportes/resumen";
import { desempenoDelEquipo } from "@/dominio/reportes/equipo";
import { usoDeConveniosEsteMes } from "@/dominio/reportes/convenios";
import { declararConvenio } from "@/dominio/convenios/gestionar";
import { rangoAnterior, rangoDe, variacion } from "@/dominio/reportes/rangos";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Los reportes del establecimiento (maqueta 2i).
 *
 * Lo que se protege: que las cifras salgan de lo que DE VERDAD se cobró. Un
 * reporte que recalculara con las tarifas de hoy contaría otra historia cada
 * vez que alguien cambia un precio, y ésa es exactamente la fiabilidad que el
 * Principio IV existe para dar.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-rep-a", rol: "admin_general" };

const admin = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-rep-a",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

const operario = (parqueaderoId: string, usuarioId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId,
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

/** Hoy a las 08:00, para que las entradas y salidas caigan en el mismo día. */
const HOY = (() => {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
})();
const salidaTras = (horas: number) => new Date(HOY.getTime() + horas * 3_600_000);

/**
 * El instante desde el que se mira el reporte.
 *
 * Va al final del día y no en "ahora mismo" porque el rango corta en el
 * presente: con la hora real, un movimiento que la prueba fecha a las 14:00
 * quedaría fuera si se ejecuta a las 13:00, y el resultado dependería de a qué
 * hora se corre la suite.
 */
const AHORA = (() => {
  const d = new Date(HOY);
  d.setHours(23, 30, 0, 0);
  return d;
})();

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values([
      { id: "u-rep-a", name: "Ana Gómez", email: "rep-a@ejemplo.co" },
      { id: "u-rep-1", name: "Juan Pérez", email: "rep-1@ejemplo.co" },
      { id: "u-rep-2", name: "Sandra Villa", email: "rep-2@ejemplo.co" },
    ]);
  });
}

/** $1.000 la hora, plena $5.000. La plena se alcanza a las cinco horas. */
async function conTarifas() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Reportes" });
  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;

  await declararTarifa(admin(p.id), {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 60,
    valorIntervalo: 1_000,
    tarifaPlena: 5_000,
    alcancePlena: "jornada",
  });

  // La tarifa nace vigente DESDE AHORA, y estas pruebas fechan los movimientos
  // a las 10:00 de hoy, que puede ser antes. Se retrasa su vigencia para poder
  // situarlos en el día en curso; es un arreglo de la prueba, no una capacidad
  // del producto.
  await comoPlataforma("administracion_plataforma", (tx) =>
    tx.execute(sql`update tarifa set vigente_desde = now() - interval '3 years'`),
  );

  return p.id;
}

async function cobrar(ctx: Contexto, placa: string, horas: number) {
  const mov = await registrarEntrada(ctx, placa, HOY);
  return registrarSalida(ctx, mov.id, salidaTras(horas));
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("los rangos", () => {
  it("la semana arranca el lunes, incluso mirándola un domingo", () => {
    // El domingo es `getDay() === 0`; sin corregirlo se llevaría la semana
    // siguiente entera y el reporte del domingo saldría vacío.
    const domingo = new Date("2026-08-23T15:00:00-05:00");
    const r = rangoDe("semana", domingo);
    const inicio = new Date(r.desde.toLocaleString("en-US", { timeZone: "America/Bogota" }));

    expect(inicio.getDay()).toBe(1);
    expect(r.desde.getTime()).toBeLessThan(domingo.getTime());
  });

  it("el período anterior es del MISMO largo, no el mes calendario", () => {
    // Comparar cinco días de este mes contra treinta del pasado daría una caída
    // que no ocurrió.
    const r = rangoDe("mes", new Date("2026-08-05T15:00:00-05:00"));
    const previo = rangoAnterior(r);

    expect(previo.hasta.getTime()).toBe(r.desde.getTime());
    expect(previo.hasta.getTime() - previo.desde.getTime()).toBe(
      r.hasta.getTime() - r.desde.getTime(),
    );
  });

  it("sin nada antes no se inventa un porcentaje", () => {
    expect(variacion(1000, 0)).toBeNull();
    expect(variacion(110, 100)).toBeCloseTo(10);
  });
});

describe("las cifras del reporte", () => {
  it("suma ingresos, cuenta movimientos y promedia permanencia", async () => {
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    await cobrar(ctx, "AAA111", 2); // $2.000
    await cobrar(ctx, "BBB222", 4); // $4.000

    const r = (await reporteDelEstablecimiento(ctx, "dia", AHORA))!;

    expect(r.actual.ingresos).toBe(6_000);
    expect(r.actual.movimientos).toBe(2);
    expect(r.actual.permanenciaMedia).toBe(180); // 2h y 4h → media 3h
    expect(r.actual.ticketPromedio).toBe(3_000);
  });

  it("cuenta qué porcentaje topó la tarifa plena", async () => {
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    await cobrar(ctx, "AAA111", 2); // $2.000, sin tope
    await cobrar(ctx, "BBB222", 9); // topa la plena en $5.000

    const r = (await reporteDelEstablecimiento(ctx, "dia", AHORA))!;

    expect(r.actual.ingresos).toBe(7_000);
    expect(r.actual.porcentajeEnPlena).toBe(50);
  });

  it("cuenta el importe CORREGIDO, no el original", async () => {
    // El total tiene que cuadrar con la caja, y en la caja está lo que se cobró
    // de verdad.
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    const mov = await cobrar(ctx, "AAA111", 4); // $4.000
    expect(mov.importe).toBe(4_000);

    await emitirCorreccion(ctx, mov.id, 1_500, "Se cobró de más");

    const r = (await reporteDelEstablecimiento(ctx, "dia", AHORA))!;
    expect(r.actual.ingresos).toBe(1_500);
  });

  it("desglosa la permanencia por tipo de vehículo", async () => {
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    await cobrar(ctx, "AAA111", 2);
    await cobrar(ctx, "BBB222", 4);

    const r = (await reporteDelEstablecimiento(ctx, "dia", AHORA))!;
    const autos = r.porTipo.find((t) => t.nombre === "Automóvil");

    expect(autos?.movimientos).toBe(2);
    expect(autos?.permanenciaMedia).toBe(180);
  });

  it("reparte los ingresos por persona, con su nombre", async () => {
    const parqueaderoId = await conTarifas();

    await cobrar(operario(parqueaderoId, "u-rep-1"), "AAA111", 4); // $4.000
    await cobrar(operario(parqueaderoId, "u-rep-2"), "BBB222", 1); // $1.000

    const r = (await reporteDelEstablecimiento(admin(parqueaderoId), "dia", AHORA))!;

    // De mayor a menor, que es como la maqueta los ordena.
    expect(r.porPersona.map((p) => p.nombre)).toEqual(["Juan Pérez", "Sandra Villa"]);
    expect(r.porPersona[0]?.ingresos).toBe(4_000);
  });

  it("las horas sin entradas salen en cero, no se saltan", async () => {
    // Un hueco en el histograma significa "a esa hora no entró nadie", que es
    // información. Comprimirlo haría parecer que el parqueadero nunca descansa.
    const parqueaderoId = await conTarifas();
    await cobrar(admin(parqueaderoId), "AAA111", 2);

    const r = (await reporteDelEstablecimiento(admin(parqueaderoId), "dia", AHORA))!;

    // La hora se calcula en la zona del establecimiento, que no tiene por qué
    // ser la del servidor donde corre la suite, así que se deriva en vez de
    // escribirse a mano.
    const horaEsperada = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        hour12: false,
      }).format(HOY),
    );

    expect(r.porHora).toHaveLength(24);
    expect(r.porHora.find((h) => h.hora === horaEsperada)?.entradas).toBe(1);
    expect(r.porHora.filter((h) => h.entradas === 0)).toHaveLength(23);
  });
});

describe("el desempeño del equipo (maqueta 8c)", () => {
  it("reparte lo vendido por cuenta y dice quién está en turno", async () => {
    const parqueaderoId = await conTarifas();

    // Las cuentas tienen que estar ASIGNADAS al establecimiento para salir.
    await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`
        insert into asignacion (usuario_id, parqueadero_id, rol)
        values ('u-rep-1', ${parqueaderoId}, 'operario'),
               ('u-rep-2', ${parqueaderoId}, 'operario')
      `),
    );

    await cobrar(operario(parqueaderoId, "u-rep-1"), "AAA111", 4); // $4.000
    await cobrar(operario(parqueaderoId, "u-rep-2"), "BBB222", 1); // $1.000

    const desempeno = await desempenoDelEquipo(admin(parqueaderoId), AHORA);

    expect(desempeno.get("u-rep-1")?.vendido).toBe(4_000);
    expect(desempeno.get("u-rep-2")?.vendido).toBe(1_000);
    // Nadie abrió turno todavía.
    expect(desempeno.get("u-rep-1")?.enTurno).toBe(false);
    expect(desempeno.get("u-rep-1")?.turnos).toEqual([]);
  });

  it("una cuenta sin cobros aparece igual, en cero", async () => {
    // Esconderla haría parecer que no trabaja acá, y lo que no vendió es
    // justamente lo que el administrador quiere ver.
    const parqueaderoId = await conTarifas();
    await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`
        insert into asignacion (usuario_id, parqueadero_id, rol)
        values ('u-rep-1', ${parqueaderoId}, 'operario')
      `),
    );

    const desempeno = await desempenoDelEquipo(admin(parqueaderoId), AHORA);
    expect(desempeno.get("u-rep-1")?.vendido).toBe(0);
  });
});

describe("el uso de los convenios (maqueta 8b)", () => {
  it("cuenta los usos reales y lo que se dejó de cobrar", async () => {
    // Sale de la copia embebida del cobro: un convenio que hoy descuenta el
    // 20 % pudo descontar el 30 % el mes pasado, y lo que se dejó de cobrar
    // entonces fue el 30 %.
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    const convenio = await declararConvenio(ctx, {
      nombre: "Comercio vecino",
      activacion: "sello",
      beneficio: "porcentaje",
      valor: 50,
      limiteDiario: null,
    });

    const mov = await registrarEntrada(ctx, "AAA111", HOY);
    await registrarSalida(ctx, mov.id, salidaTras(4), [convenio.id]); // $4.000 → $2.000

    const uso = await usoDeConveniosEsteMes(ctx, AHORA);

    expect(uso.get(convenio.id)?.usos).toBe(1);
    expect(uso.get(convenio.id)?.sinCobrar).toBe(2_000);
  });

  it("un convenio que no se aplicó no cuenta como uso", async () => {
    // Los no aplicados viajan igual en el desglose, con su motivo, para poder
    // explicarle al cliente por qué no se le hizo el descuento. Contarlos sería
    // mentir sobre el acuerdo.
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    const convenio = await declararConvenio(ctx, {
      nombre: "Comercio vecino",
      activacion: "sello",
      beneficio: "porcentaje",
      valor: 50,
      limiteDiario: null,
    });

    // Se cobra SIN confirmar el sello, así que el convenio no entra.
    const mov = await registrarEntrada(ctx, "AAA111", HOY);
    await registrarSalida(ctx, mov.id, salidaTras(4));

    const uso = await usoDeConveniosEsteMes(ctx, AHORA);
    expect(uso.get(convenio.id)?.usos ?? 0).toBe(0);
  });
});

describe("quién ve qué", () => {
  it("un operario sólo ve lo que él cobró", async () => {
    const parqueaderoId = await conTarifas();

    await cobrar(operario(parqueaderoId, "u-rep-1"), "AAA111", 4);
    await cobrar(operario(parqueaderoId, "u-rep-2"), "BBB222", 1);

    const suyo = (await reporteDelEstablecimiento(operario(parqueaderoId, "u-rep-1"), "dia", AHORA))!;

    expect(suyo.soloMios).toBe(true);
    expect(suyo.actual.ingresos).toBe(4_000);
    expect(suyo.actual.movimientos).toBe(1);
  });

  it("el administrador ve el establecimiento entero", async () => {
    const parqueaderoId = await conTarifas();

    await cobrar(operario(parqueaderoId, "u-rep-1"), "AAA111", 4);
    await cobrar(operario(parqueaderoId, "u-rep-2"), "BBB222", 1);

    const todo = (await reporteDelEstablecimiento(admin(parqueaderoId), "dia", AHORA))!;

    expect(todo.soloMios).toBe(false);
    expect(todo.actual.ingresos).toBe(5_000);
  });

  it("sin ningún turno abierto, el período «turno» lo dice en vez de fingir", async () => {
    const parqueaderoId = await conTarifas();
    expect(await reporteDelEstablecimiento(admin(parqueaderoId), "turno")).toBeNull();
  });
});
