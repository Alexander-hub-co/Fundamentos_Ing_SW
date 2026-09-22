import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { movimiento, parqueadero, tipoVehiculo, usuario, RETENCION_MESES } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { devolverBicicleta, recibirBicicleta } from "@/dominio/taquilla/registrar";
import { purgarAuditoriaVencida, registrosVencidos } from "@/dominio/auditoria/retencion";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * La obligación que trajo pedir la cédula.
 *
 * Pedir cédula y teléfono es tratamiento de datos personales, y en Colombia eso
 * obliga a no conservarlos más de lo necesario. Lo que se prueba acá es la
 * distinción que importa: **el dato personal se va, la contabilidad se queda**.
 * Borrar el movimiento entero sería tan incorrecto como conservar la cédula
 * para siempre, sólo que en la otra dirección.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-ret", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-ret",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-ret",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-ret", name: "Operario", email: "ret@ejemplo.co" });
  });
}

async function conBicicletas() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Retención" });
  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const bici = tipos.find((t) => t.codigo === "bicicleta")!;

  await declararTarifa(comoAdminDe(p.id), {
    tipoVehiculoId: bici.id,
    modelo: "por_intervalo",
    intervaloMinutos: 30,
    valorIntervalo: 500,
    tarifaPlena: 4_000,
    alcancePlena: "jornada",
  });
  await declararCapacidad(comoAdminDe(p.id), bici.id, 5);

  // La tarifa nace vigente DESDE AHORA, así que un movimiento fechado hace
  // trece meses no encontraría ninguna y el motor haría bien en decirlo. Se
  // retrasa su vigencia para poder simular el paso del tiempo; es un arreglo
  // de la prueba, no una capacidad del producto.
  await comoPlataforma("administracion_plataforma", (tx) =>
    tx.execute(sql`update tarifa set vigente_desde = now() - interval '3 years'`),
  );

  return p.id;
}

/** Un instante anterior al plazo de retención, para simular el paso del tiempo. */
function haceMasDeLaRetencion(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - RETENCION_MESES - 1);
  return d;
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("los datos personales de las bicicletas se purgan", () => {
  it("pasado el plazo no queda cédula ni teléfono ni seña, pero el cobro sigue entero", async () => {
    const parqueaderoId = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    const entrada = haceMasDeLaRetencion();
    const salida = new Date(entrada.getTime() + 3 * 60 * 60 * 1000);

    const mov = await recibirBicicleta(
      ctx,
      { nombre: "Ana Ruiz", cedula: "1020304050", telefono: "3001234567", nota: "Negra, marca Trek" },
      entrada,
    );
    const cerrado = await devolverBicicleta(ctx, mov.id, salida);
    expect(cerrado.importe).toBe(3_000);

    const pendientes = await registrosVencidos();
    expect(pendientes.movimientos).toBe(1);

    const resultado = await purgarAuditoriaVencida();
    expect(resultado.movimientosAnonimizados).toBe(1);

    const [despues] = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(sql`id = ${mov.id}`),
    );

    // Se fue lo que identifica a una persona…
    expect(despues?.nombre).toBeNull();
    expect(despues?.cedula).toBeNull();
    expect(despues?.telefono).toBeNull();
    expect(despues?.notaVehiculo).toBeNull();

    // …y se quedó la contabilidad, que el Principio IV protege y que los
    // reportes necesitan.
    expect(despues?.importe).toBe(3_000);
    expect(despues?.codigo).toBe(cerrado.codigo);
    expect(despues?.salidaEn).not.toBeNull();
    expect(despues?.cobro).not.toBeNull();
  });

  it("un movimiento ABIERTO conserva la cédula aunque sea viejo", async () => {
    // Es la vía para devolver la bicicleta si se perdió el tarjetón, así que
    // mientras la bicicleta esté adentro el dato todavía cumple su finalidad.
    const parqueaderoId = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await recibirBicicleta(
      ctx,
      { nombre: "Ana Ruiz", cedula: "1020304050", telefono: "3001234567" },
      haceMasDeLaRetencion(),
    );

    await purgarAuditoriaVencida();

    const [despues] = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(sql`id = ${mov.id}`),
    );
    expect(despues?.cedula).toBe("1020304050");
  });

  it("un movimiento reciente no se toca", async () => {
    const parqueaderoId = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);
    const ahora = new Date();

    const mov = await recibirBicicleta(
      ctx,
      { nombre: "Ana Ruiz", cedula: "1020304050", telefono: "3001234567" },
      new Date(ahora.getTime() - 60 * 60 * 1000),
    );
    await devolverBicicleta(ctx, mov.id, ahora);

    const resultado = await purgarAuditoriaVencida();
    expect(resultado.movimientosAnonimizados).toBe(0);

    const [despues] = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(sql`id = ${mov.id}`),
    );
    expect(despues?.cedula).toBe("1020304050");
  });
});
