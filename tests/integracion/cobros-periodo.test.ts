import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { registrarCortesia, registrarEntrada, registrarSalida } from "@/dominio/taquilla/registrar";
import { cobrosDelPeriodo, inicioDe } from "@/dominio/reportes/cobros";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Los cobros por período.
 *
 * Lo que de verdad importa acá es la última prueba: **un operario ve sólo lo
 * que él cobró**. Un operario que puede ver la caja de sus compañeros puede
 * compararla, y eso no es asunto suyo.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-cob-a", rol: "admin_general" };

const operario = (parqueaderoId: string, usuarioId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId,
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const admin = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-cob-a",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
})();
const ENTRADA = new Date(BASE);
const SALIDA = new Date(BASE.getTime() + 2 * 60 * 60 * 1000);

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values([
      { id: "u-cob-a", name: "Admin", email: "cob-a@ejemplo.co" },
      { id: "u-cob-1", name: "Juan", email: "cob-1@ejemplo.co" },
      { id: "u-cob-2", name: "Marcela", email: "cob-2@ejemplo.co" },
    ]);
  });
}

async function conTarifas() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Cobros" });
  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;

  await declararTarifa(admin(p.id), {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 60,
    valorIntervalo: 1_000,
    tarifaPlena: 18_000,
    alcancePlena: "jornada",
  });

  return p.id;
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("los períodos", () => {
  it("hoy empieza a medianoche, el mes el día 1 y el semestre seis meses atrás", () => {
    const ahora = new Date("2026-08-22T15:30:00-05:00");

    expect(inicioDe("hoy", ahora).getTime()).toBeLessThan(ahora.getTime());
    expect(inicioDe("mes", ahora).getTime()).toBeLessThanOrEqual(inicioDe("hoy", ahora).getTime());
    expect(inicioDe("semestre", ahora).getTime()).toBeLessThan(inicioDe("mes", ahora).getTime());

    // Seis meses cuenta el actual: de agosto se llega a marzo.
    const semestre = inicioDe("semestre", ahora);
    const meses =
      (ahora.getFullYear() - semestre.getFullYear()) * 12 +
      (ahora.getMonth() - semestre.getMonth());
    expect(meses).toBe(5);
  });
});

describe("qué muestra el resumen", () => {
  it("suma lo cobrado y cuenta las cortesías aparte", async () => {
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    const uno = await registrarEntrada(ctx, "AAA111", ENTRADA);
    await registrarSalida(ctx, uno.id, SALIDA);

    const dos = await registrarEntrada(ctx, "BBB222", ENTRADA);
    await registrarCortesia(ctx, dos.id, "Es del dueño", SALIDA);

    const r = await cobrosDelPeriodo(ctx, "mes");

    expect(r.cobros).toHaveLength(2);
    // Dos horas a $1.000 la hora.
    expect(r.total).toBe(2_000);
    expect(r.cortesias.cuantas).toBe(1);
    expect(r.cortesias.omitido).toBe(2_000);
  });

  it("una bicicleta aparece por su ficha y un carro por su placa", async () => {
    const parqueaderoId = await conTarifas();
    const ctx = admin(parqueaderoId);

    const mov = await registrarEntrada(ctx, "AAA111", ENTRADA);
    await registrarSalida(ctx, mov.id, SALIDA);

    const r = await cobrosDelPeriodo(ctx, "hoy");
    expect(r.cobros[0]?.rotulo).toBe("AAA111");
  });
});

describe("un operario ve sólo lo suyo", () => {
  it("no aparecen los cobros de otro operario", async () => {
    // ES la garantía de esta pantalla: comparar cajas no es asunto de un
    // operario.
    const parqueaderoId = await conTarifas();
    const juan = operario(parqueaderoId, "u-cob-1");
    const marcela = operario(parqueaderoId, "u-cob-2");

    const deJuan = await registrarEntrada(juan, "AAA111", ENTRADA);
    await registrarSalida(juan, deJuan.id, SALIDA);

    const deMarcela = await registrarEntrada(marcela, "BBB222", ENTRADA);
    await registrarSalida(marcela, deMarcela.id, SALIDA);

    const visto = await cobrosDelPeriodo(juan, "mes");

    expect(visto.soloMios).toBe(true);
    expect(visto.cobros).toHaveLength(1);
    expect(visto.cobros[0]?.rotulo).toBe("AAA111");
    expect(visto.total).toBe(2_000);
  });

  it("el administrador ve los de todos", async () => {
    const parqueaderoId = await conTarifas();
    const juan = operario(parqueaderoId, "u-cob-1");
    const marcela = operario(parqueaderoId, "u-cob-2");

    const deJuan = await registrarEntrada(juan, "AAA111", ENTRADA);
    await registrarSalida(juan, deJuan.id, SALIDA);
    const deMarcela = await registrarEntrada(marcela, "BBB222", ENTRADA);
    await registrarSalida(marcela, deMarcela.id, SALIDA);

    const visto = await cobrosDelPeriodo(admin(parqueaderoId), "mes");

    expect(visto.soloMios).toBe(false);
    expect(visto.cobros).toHaveLength(2);
    expect(visto.total).toBe(4_000);
  });
});
