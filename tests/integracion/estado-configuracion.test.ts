import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, tarifa, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { declararHorario } from "@/dominio/horarios/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { estadoDeConfiguracion } from "@/dominio/parqueaderos/estado-configuracion";
import { NoAutorizado } from "@/lib/autorizacion";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/**
 * Pantalla 8a — qué le falta al establecimiento antes de poder operar.
 *
 * Lo que se comprueba no es el formato de las frases sino que los pendientes
 * aparezcan y desaparezcan cuando corresponde: un aviso que no se va después
 * de arreglar lo que señalaba entrena a la gente a ignorarlo.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-estado",
  rol: "admin_general",
};

const comoAdminDe = (
  parqueaderoId: string,
  estado: EstadoParqueadero = "activo",
): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-estado",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado,
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from horario_franja`);
    await tx.execute(sql`delete from horario_atencion`);
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from ${tarifa}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-estado",
      name: "Admin",
      email: "estado@ejemplo.co",
    });
  });
}

const tipos = () =>
  comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)),
  );

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("estado de la configuración propia", () => {
  it("un parqueadero recién creado enumera todo lo que le falta", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Nuevo" });
    const catalogo = await tipos();

    const estado = await estadoDeConfiguracion(comoAdminDe(p.id));

    // Un pendiente por cada tipo del catálogo, más horario y capacidad.
    expect(estado.pendientes).toHaveLength(catalogo.length + 2);
    expect(estado.pendientes.some((t) => t.includes("horario declarado"))).toBe(true);
    expect(estado.pendientes.some((t) => t.includes("capacidad declarada"))).toBe(true);

    // Y las cinco líneas están, aunque no haya nada declarado: la pantalla
    // tiene que llevar a configurarlas, que es justo cuando más hace falta.
    expect(estado.lineas.map((l) => l.rotulo)).toEqual([
      "Horario",
      "Tarifas",
      "Capacidad",
      "Turnos",
      "Convenios",
    ]);
    expect(estado.lineas.every((l) => l.href.startsWith("/configuracion/"))).toBe(true);
  });

  it("declarar la tarifa de un tipo quita ese pendiente y deja los demás", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Parcial" });
    const ctx = comoAdminDe(p.id);
    const catalogo = await tipos();
    const automovil = catalogo[0]!;

    await declararTarifa(ctx, {
      tipoVehiculoId: automovil.id,
      modelo: "por_minuto",
      alcancePlena: "jornada",
      tarifaPlena: 14_000,
      tarifaMinima: 500,
      valorMinuto: 60,
    });

    const estado = await estadoDeConfiguracion(ctx);

    expect(estado.pendientes.some((t) => t.startsWith(automovil.nombre))).toBe(false);
    expect(estado.lineas.find((l) => l.rotulo === "Tarifas")?.resumen).toBe(
      `1 de ${catalogo.length} tipos declarados`,
    );
  });

  it("con horario y capacidad declarados, esos dos pendientes desaparecen", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Puesto" });
    const ctx = comoAdminDe(p.id);
    const catalogo = await tipos();

    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: [1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        diaSemana,
        horaApertura: "07:00",
        horaCierre: "20:00",
      })),
    });
    await declararCapacidad(ctx, catalogo[0]!.id, 70);

    const estado = await estadoDeConfiguracion(ctx);

    expect(estado.pendientes.some((t) => t.includes("horario declarado"))).toBe(false);
    expect(estado.pendientes.some((t) => t.includes("capacidad declarada"))).toBe(false);
    expect(estado.lineas.find((l) => l.rotulo === "Horario")?.resumen).toBe(
      "07:00–20:00, lun a sáb",
    );
    expect(estado.lineas.find((l) => l.rotulo === "Capacidad")?.resumen).toBe(
      "70 cupos · 0 ocupados",
    );
  });

  it("la plataforma no entra por esta puerta", async () => {
    // `parqueadero.ver.propio` es del establecimiento. Para mirar configuración
    // ajena existe `resumenDeConfiguracion`, que pasa por la puerta de soporte
    // y deja asiento de auditoría; ésta no, y por eso tiene que cerrarse.
    await expect(estadoDeConfiguracion(ADMIN_GENERAL)).rejects.toThrow(NoAutorizado);
  });
});
