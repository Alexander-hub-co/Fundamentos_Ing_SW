import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { crearTurno } from "@/dominio/turnos/gestionar";
import { abrirSesion, cerrarSesion, sesionAbiertaDe, SesionInvalida } from "@/dominio/turnos/sesiones";
import {
  registrarEntrada,
  registrarSalida,
} from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero } from "@/db/esquema";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Historia 2 — quién atendió y en qué turno.
 *
 * El ciclo del vehículo funciona sin esto, pero sin turnos no se puede cuadrar
 * una caja ni saber a quién preguntarle por un cobro raro.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-turno", rol: "admin_general" };

const comoOperario = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-turno",
  rol: "operario",
  parqueaderoId,
  estado,
});
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-turno",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

/**
 * Los instantes van DESPUÉS de ahora, no en una fecha fija del pasado.
 *
 * La tarifa se declara al preparar cada prueba, con vigencia desde ese momento,
 * así que una entrada fechada ayer no encontraría ninguna tarifa vigente —y el
 * sistema haría bien en decirlo—. Es la primera trampa de probar algo que
 * depende de versiones por rango.
 */
const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Y a las diez de la mañana, no a la hora que sea. Una ventana de cinco horas
  // que arranque de noche cruzaría la medianoche, el motor la partiría en dos
  // jornadas y redondearía los intervalos en cada una: 21 en vez de 20. El
  // cálculo estaría bien y la prueba sería frágil.
  d.setHours(10, 0, 0, 0);
  return d;
})();
const ENTRADA = new Date(BASE);
const SALIDA = new Date(BASE.getTime() + 5 * 60 * 60 * 1000); // cinco horas

async function limpiar() {
  // Los movimientos van aparte, por el rol dueño: el disparador de
  // inmutabilidad no deja borrarlos desde ninguno de los roles que usa la
  // aplicación, que es exactamente lo que se quiere.
  await limpiarMovimientos();

  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from delegacion`);
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-turno", name: "Operario", email: "turno@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

/** Un establecimiento con tarifa para carros: $700 cada 15 min, plena $18.000. */
async function conTarifas() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Taquilla" });
  const admin = comoAdminDe(p.id);

  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;

  await declararTarifa(admin, {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 18_000,
    alcancePlena: "jornada",
  });

  return { parqueaderoId: p.id, autoId: auto.id, tipos };
}

/** Un turno declarado que trabaja todos los días. */
async function turnoDeclarado(parqueaderoId: string, nombre = "Mañana") {
  return crearTurno(comoAdminDe(parqueaderoId), {
    nombre,
    horaInicio: "07:00",
    horaFin: "15:00",
    dias: [0, 1, 2, 3, 4, 5, 6],
  });
}

describe("abrir y cerrar el turno", () => {
  it("guarda la hora REAL además de la programada", async () => {
    // Casi nunca coinciden, y la diferencia es justamente lo que hay que poder
    // revisar cuando no cuadra una caja.
    const { parqueaderoId } = await conTarifas();
    const t = await turnoDeclarado(parqueaderoId);

    const abierta = await abrirSesion(comoOperario(parqueaderoId), t.id, ENTRADA);

    expect(abierta.abiertaEn).toEqual(ENTRADA);
    expect(abierta.programadaInicio).toBe("07:00:00");
    expect(abierta.programadaFin).toBe("15:00:00");
    expect(abierta.cerradaEn).toBeNull();
  });

  it("una persona no puede tener dos turnos abiertos a la vez", async () => {
    const { parqueaderoId } = await conTarifas();
    const uno = await turnoDeclarado(parqueaderoId, "Mañana");
    const dos = await turnoDeclarado(parqueaderoId, "Tarde");
    const ctx = comoOperario(parqueaderoId);

    await abrirSesion(ctx, uno.id, ENTRADA);
    await expect(abrirSesion(ctx, dos.id, ENTRADA)).rejects.toThrow(SesionInvalida);
  });

  it("cerrar registra la hora real de cierre", async () => {
    const { parqueaderoId } = await conTarifas();
    const t = await turnoDeclarado(parqueaderoId);
    const ctx = comoOperario(parqueaderoId);

    const abierta = await abrirSesion(ctx, t.id, ENTRADA);
    const cerrada = await cerrarSesion(ctx, abierta.id, SALIDA);

    expect(cerrada.cerradaEn).toEqual(SALIDA);
    expect(await sesionAbiertaDe(ctx, "u-turno")).toBeNull();
  });

  it("se puede cerrar aunque queden vehículos adentro", async () => {
    // Los vehículos son del establecimiento, no del turno. Los cierra quien
    // esté en la taquilla cuando salgan, que puede ser otra persona.
    const { parqueaderoId } = await conTarifas();
    const t = await turnoDeclarado(parqueaderoId);
    const ctx = comoOperario(parqueaderoId);

    const abierta = await abrirSesion(ctx, t.id, ENTRADA);
    await registrarEntrada(ctx, "ABC123", ENTRADA);

    await expect(cerrarSesion(ctx, abierta.id, SALIDA)).resolves.toBeDefined();
  });

  it("una sesión ya cerrada no se cierra dos veces", async () => {
    const { parqueaderoId } = await conTarifas();
    const t = await turnoDeclarado(parqueaderoId);
    const ctx = comoOperario(parqueaderoId);

    const abierta = await abrirSesion(ctx, t.id, ENTRADA);
    await cerrarSesion(ctx, abierta.id, SALIDA);

    await expect(cerrarSesion(ctx, abierta.id, SALIDA)).rejects.toThrow(SesionInvalida);
  });

  it("un turno desactivado no se puede abrir", async () => {
    const { parqueaderoId } = await conTarifas();
    const t = await turnoDeclarado(parqueaderoId);
    await conAmbito(parqueaderoId, (tx) =>
      tx.execute(sql`update turno set activo = false where id = ${t.id}`),
    );

    await expect(abrirSesion(comoOperario(parqueaderoId), t.id, ENTRADA)).rejects.toThrow(
      SesionInvalida,
    );
  });
});

describe("cada movimiento queda atribuido", () => {
  it("a la sesión abierta en ese momento", async () => {
    const { parqueaderoId } = await conTarifas();
    const t = await turnoDeclarado(parqueaderoId);
    const ctx = comoOperario(parqueaderoId);

    const sesion = await abrirSesion(ctx, t.id, ENTRADA);
    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);

    expect(mov.sesionEntrada).toBe(sesion.id);
  });

  it("con UN TURNO POR EXTREMO cuando entra en uno y sale en otro", async () => {
    // Es lo normal en un carro que se queda toda la tarde, y la razón de que el
    // movimiento guarde dos y no uno.
    const { parqueaderoId } = await conTarifas();
    const manana = await turnoDeclarado(parqueaderoId, "Mañana");
    const tarde = await turnoDeclarado(parqueaderoId, "Tarde");
    const ctx = comoOperario(parqueaderoId);

    const sesionManana = await abrirSesion(ctx, manana.id, ENTRADA);
    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await cerrarSesion(ctx, sesionManana.id, ENTRADA);

    const sesionTarde = await abrirSesion(ctx, tarde.id, SALIDA);
    const cerrado = await registrarSalida(ctx, mov.id, SALIDA);

    expect(cerrado.sesionEntrada).toBe(sesionManana.id);
    expect(cerrado.sesionSalida).toBe(sesionTarde.id);
    expect(cerrado.sesionEntrada).not.toBe(cerrado.sesionSalida);
  });
});

describe("sin sesión abierta se opera igual", () => {
  it("el movimiento se registra y queda sin turno", async () => {
    // No se puede dejar un carro afuera porque nadie abrió su turno. Un olvido
    // administrativo no puede parar la operación.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);

    expect(mov.sesionEntrada).toBeNull();
    expect(mov.id).toBeDefined();
  });

  it("y también se puede cobrar la salida", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);

    const cerrado = await registrarSalida(ctx, mov.id, SALIDA);
    expect(cerrado.sesionSalida).toBeNull();
    expect(cerrado.importe).toBe(14_000);
  });
});
