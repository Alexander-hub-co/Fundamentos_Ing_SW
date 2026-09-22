import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usoPrivilegio, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { comoEstablecimiento } from "@/dominio/configuracion/como-plataforma";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { tarifasVigentes } from "@/dominio/tarifas/consultar";
import { declararHorario } from "@/dominio/horarios/declarar";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { NoAutorizado, EstablecimientoRestringido } from "@/lib/autorizacion";
import { RecursoNoAlcanzable } from "@/lib/errores";
import type { Contexto } from "@/lib/sesion";

/**
 * FR-029 — el administrador general da soporte sobre un establecimiento ajeno.
 *
 * Lo que se verifica no es sólo que pueda, sino que quede rastro y que no se
 * convierta en una puerta trasera: el modo restringido le sigue aplicando y el
 * administrador de un local no puede usar este camino.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-sop", rol: "admin_general" };

const CARRO = {
  modelo: "por_minuto" as const,
  alcancePlena: "jornada" as const,
  tarifaPlena: 14_000,
  tarifaMinima: 500,
  valorMinuto: 60,
};

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from horario_franja`);
    await tx.execute(sql`delete from horario_atencion`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from ${usoPrivilegio}`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-sop", name: "Soporte", email: "sop@ejemplo.co" });
  });
}

const unTipo = async () =>
  (await comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)).limit(1),
  ))[0]!;

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("el administrador general puede configurar un establecimiento ajeno", () => {
  it("declara una tarifa que el establecimiento después ve como suya", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Cliente" });
    const tipo = await unTipo();

    const soporte = await comoEstablecimiento(ADMIN, p.id, "declarar_tarifa");
    await declararTarifa(soporte, { tipoVehiculoId: tipo.id, ...CARRO });

    const vigentes = await tarifasVigentes(soporte);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0]!.tarifa.valorMinuto).toBe(60);
  });

  it("también el horario", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Horario Sop" });
    const soporte = await comoEstablecimiento(ADMIN, p.id, "declarar_horario");

    await declararHorario(soporte, {
      abierto24h: false,
      cobraHorasCerradas: true,
      franjas: [{ diaSemana: 1, horaApertura: "06:00", horaCierre: "22:00" }],
    });

    expect((await horarioDelCobro(soporte)).cobraHorasCerradas).toBe(true);
  });
});

describe("el cambio queda distinguible de uno del propio establecimiento", () => {
  it("deja asiento en la auditoría de privilegio, con quién y qué", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Auditado" });
    await comoEstablecimiento(ADMIN, p.id, "declarar_tarifa");

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usoPrivilegio),
    );

    const soporte = asientos.filter((a) => a.operacion.startsWith("soporte."));
    expect(soporte).toHaveLength(1);
    expect(soporte[0]!.operacion).toBe("soporte.declarar_tarifa");
    expect(soporte[0]!.usuarioId).toBe("u-sop");
  });

  it("la tarifa queda con el administrador general como autor", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Autor" });
    const tipo = await unTipo();
    const soporte = await comoEstablecimiento(ADMIN, p.id, "declarar_tarifa");

    const creada = await declararTarifa(soporte, { tipoVehiculoId: tipo.id, ...CARRO });
    expect(creada.creadaPor).toBe("u-sop");
  });

  it("anota el intento aunque la operación falle después", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Fallido" });
    const soporte = await comoEstablecimiento(ADMIN, p.id, "declarar_tarifa");

    await declararTarifa(soporte, {
      tipoVehiculoId: "00000000-0000-0000-0000-000000000000",
      ...CARRO,
    }).catch(() => {});

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usoPrivilegio),
    );
    expect(asientos.some((a) => a.operacion === "soporte.declarar_tarifa")).toBe(true);
  });
});

describe("no es una puerta trasera", () => {
  it("el administrador de un local no puede usar este camino", async () => {
    const propio = await crearParqueadero(ADMIN, { nombre: "Parqueadero Propio Sop" });
    const ajeno = await crearParqueadero(ADMIN, { nombre: "Parqueadero Ajeno Sop" });

    const delLocal: Contexto = {
      tipo: "establecimiento",
      usuarioId: "u-sop",
      rol: "admin_parqueadero",
      parqueaderoId: propio.id,
      estado: "activo",
    };

    await expect(comoEstablecimiento(delLocal, ajeno.id, "declarar_tarifa")).rejects.toThrow(
      NoAutorizado,
    );
  });

  it("un establecimiento inexistente responde como uno fuera de alcance", async () => {
    await expect(
      comoEstablecimiento(ADMIN, "00000000-0000-0000-0000-0000000000ff", "declarar_tarifa"),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("el modo restringido le aplica también al soporte", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Sop Suspenso" });
    const tipo = await unTipo();

    await cambiarEstadoParqueadero(ADMIN, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "prueba de modo restringido",
    });

    // El contexto derivado lleva el estado REAL, no uno inventado: si el local
    // está suspendido, tampoco el soporte le cambia la configuración.
    const soporte = await comoEstablecimiento(ADMIN, p.id, "declarar_tarifa");
    await expect(
      declararTarifa(soporte, { tipoVehiculoId: tipo.id, ...CARRO }),
    ).rejects.toThrow(EstablecimientoRestringido);
  });
});
