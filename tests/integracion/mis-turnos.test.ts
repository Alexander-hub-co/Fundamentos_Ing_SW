import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { crearTurno } from "@/dominio/turnos/gestionar";
import { abrirSesion, cerrarSesion } from "@/dominio/turnos/sesiones";
import { registrarEntrada, registrarSalida } from "@/dominio/taquilla/registrar";
import { misTurnosPasados, miTurnoAbierto } from "@/dominio/reportes/turnos";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Las cifras de ENTREGA del turno (maqueta 5a, "Pendientes de mi turno").
 *
 * No dicen cuánto se vendió sino qué queda por resolver cuando llegue el
 * relevo. La tercera —salidas que cerré de vehículos que recibió otro— es la
 * que importa: una entrada y su salida pueden ser de turnos distintos, y
 * confundirlas es la fuente de casi todos los desacuerdos al cuadrar la caja.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-mr", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-mr",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-mr",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

/** Mañana a las siete: la tarifa se declara ahora y rige desde ahora. */
const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(7, 0, 0, 0);
  return d;
})();
const enMinutos = (m: number) => new Date(BASE.getTime() + m * 60_000);

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from delegacion`);
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-mr", name: "Operario", email: "mr@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

async function establecimiento() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Turnos" });
  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;

  await declararTarifa(comoAdminDe(p.id), {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 18_000,
    alcancePlena: "jornada",
  });

  return p.id;
}

const turno = (parqueaderoId: string, nombre: string, inicio: string, fin: string) =>
  crearTurno(comoAdminDe(parqueaderoId), {
    nombre,
    horaInicio: inicio,
    horaFin: fin,
    dias: [0, 1, 2, 3, 4, 5, 6],
  });

describe("pendientes del turno abierto", () => {
  it("separa lo que entró conmigo de lo que ya estaba adentro", async () => {
    const parqueaderoId = await establecimiento();
    const manana = await turno(parqueaderoId, "Mañana", "07:00", "15:00");
    const tarde = await turno(parqueaderoId, "Tarde", "15:00", "22:00");
    const ctx = comoOperario(parqueaderoId);

    // Turno de la mañana: entran dos carros y ninguno sale.
    const s1 = await abrirSesion(ctx, manana.id, BASE);
    const seQueda = await registrarEntrada(ctx, "AAA111", enMinutos(30));
    const saleDespues = await registrarEntrada(ctx, "BBB222", enMinutos(45));
    await cerrarSesion(ctx, s1.id, enMinutos(480));

    // Turno de la tarde, del mismo operario: cobra uno de los dos.
    await abrirSesion(ctx, tarde.id, enMinutos(481));
    await registrarSalida(ctx, saleDespues.id, enMinutos(500));

    const abierto = await miTurnoAbierto(ctx, enMinutos(520));

    expect(abierto?.nombre).toBe("Tarde");
    // Queda adentro el que nunca salió, aunque entró en el otro turno.
    expect(abierto?.pendientes.adentro).toBe(1);
    // Pero no entró conmigo: en ESTE turno no abrí ninguna entrada.
    expect(abierto?.pendientes.miasAbiertas).toBe(0);
    // Y la salida que cobré era de un carro que recibió el turno anterior.
    expect(abierto?.pendientes.cerradasDeOtroTurno).toBe(1);
    expect(seQueda.salidaEn).toBeNull();
  });

  it("no cuenta como ajena una salida cuya entrada fue del mismo turno", async () => {
    const parqueaderoId = await establecimiento();
    const manana = await turno(parqueaderoId, "Mañana", "07:00", "15:00");
    const ctx = comoOperario(parqueaderoId);

    await abrirSesion(ctx, manana.id, BASE);
    const m = await registrarEntrada(ctx, "CCC333", enMinutos(20));
    await registrarSalida(ctx, m.id, enMinutos(80));
    await registrarEntrada(ctx, "DDD444", enMinutos(90));

    const abierto = await miTurnoAbierto(ctx, enMinutos(120));

    expect(abierto?.pendientes.cerradasDeOtroTurno).toBe(0);
    expect(abierto?.pendientes.adentro).toBe(1);
    expect(abierto?.pendientes.miasAbiertas).toBe(1);
  });

  it("da ceros en un turno recién abierto, no nulos", async () => {
    // Un turno sin movimientos tiene que dibujarse igual: si estas cifras
    // llegaran indefinidas, la pantalla mostraría huecos en vez de ceros.
    const parqueaderoId = await establecimiento();
    const manana = await turno(parqueaderoId, "Mañana", "07:00", "15:00");
    const ctx = comoOperario(parqueaderoId);

    await abrirSesion(ctx, manana.id, BASE);
    const abierto = await miTurnoAbierto(ctx, enMinutos(5));

    expect(abierto?.pendientes).toEqual({
      adentro: 0,
      miasAbiertas: 0,
      cerradasDeOtroTurno: 0,
    });
    expect(abierto?.porHora).toEqual([]);
  });
});

/**
 * Las fechas que salen de acá tienen que ser fechas.
 *
 * Existe por un fallo que la compilación no podía ver: estas consultas van por
 * SQL crudo, donde el controlador entrega los `timestamptz` como TEXTO, y el
 * genérico los declaraba `Date`. Todo tipaba, todo pasaba, y la pantalla de
 * Mis turnos reventaba con `RangeError: Invalid time value` en cuanto había
 * un turno cerrado que formatear.
 *
 * Por eso las pruebas no se conforman con leer los campos: los FORMATEAN, que
 * es lo único que distingue una fecha de una cadena que se le parece.
 */
describe("las marcas de tiempo del turno", () => {
  const reloj = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  it("el turno abierto trae una fecha formateable", async () => {
    const parqueaderoId = await establecimiento();
    const manana = await turno(parqueaderoId, "Mañana", "07:00", "15:00");
    const ctx = comoOperario(parqueaderoId);

    await abrirSesion(ctx, manana.id, BASE);
    const abierto = await miTurnoAbierto(ctx, enMinutos(30));

    expect(abierto?.abiertaEn).toBeInstanceOf(Date);
    expect(() => reloj.format(abierto!.abiertaEn)).not.toThrow();
    expect(reloj.format(abierto!.abiertaEn)).toBe(reloj.format(BASE));
  });

  it("un turno cerrado trae las dos suyas, y ambas se formatean", async () => {
    const parqueaderoId = await establecimiento();
    const manana = await turno(parqueaderoId, "Mañana", "07:00", "15:00");
    const ctx = comoOperario(parqueaderoId);

    const s = await abrirSesion(ctx, manana.id, BASE);
    await cerrarSesion(ctx, s.id, enMinutos(480));

    const [pasado] = await misTurnosPasados(ctx);

    expect(pasado?.abiertaEn).toBeInstanceOf(Date);
    expect(pasado?.cerradaEn).toBeInstanceOf(Date);
    expect(reloj.format(pasado!.abiertaEn)).toBe(reloj.format(BASE));
    expect(reloj.format(pasado!.cerradaEn)).toBe(reloj.format(enMinutos(480)));
  });
});
