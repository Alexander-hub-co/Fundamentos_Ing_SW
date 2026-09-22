import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { accesoDenegado, parqueadero, tarifa, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { tarifaVigenteEn } from "@/dominio/tarifas/consultar";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import type { Contexto } from "@/lib/sesion";

/**
 * Prueba negativa del Principio I sobre las tarifas.
 *
 * Comprueba dos cosas distintas, y las dos hacen falta:
 *
 *   1. Que A no alcance las tarifas de B, ni por consulta de dominio ni yendo
 *      directo a la tabla con el ámbito de A puesto.
 *   2. Que el intento quede ANOTADO (SC-002). Denegar sin dejar rastro protege
 *      los datos pero deja el aislamiento sin auditar: nadie puede notar que
 *      alguien está probando identificadores ajenos.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-aisl-tarifas",
  rol: "admin_general",
};

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-tarifas",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

let idA: string;
let idB: string;
let tipoId: string;

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${tarifa}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-aisl-tarifas",
      name: "Admin",
      email: "aisl-tarifas@ejemplo.co",
    });
  });
}

beforeEach(async () => {
  await limpiar();

  const a = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Alfa" });
  const b = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Beta" });
  idA = a.id;
  idB = b.id;

  const [tipo] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(tipoVehiculo).where(eq(tipoVehiculo.codigo, "automovil")).limit(1),
  );
  tipoId = tipo!.id;

  // B declara una tarifa que A no debe poder ver de ninguna forma.
  await declararTarifa(comoAdminDe(idB), {
    tipoVehiculoId: tipoId,
    modelo: "por_minuto",
    alcancePlena: "jornada",
    tarifaPlena: 14_000,
    tarifaMinima: 500,
    valorMinuto: 60,
  });
});

afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("A no alcanza las tarifas de B", () => {
  it("la consulta de dominio desde A no devuelve la tarifa de B", async () => {
    const vista = await tarifaVigenteEn(comoAdminDe(idA), tipoId, new Date());
    expect(vista).toBeNull();
  });

  it("ir directo a la tabla con el ámbito de A tampoco la devuelve", async () => {
    const filas = await conAmbito(idA, (tx) => tx.select().from(tarifa));
    expect(filas).toEqual([]);
  });

  it("y B sí ve la suya, para descartar que todo devuelva vacío", async () => {
    const filas = await conAmbito(idB, (tx) => tx.select().from(tarifa));
    expect(filas).toHaveLength(1);
    expect(filas[0]!.valorMinuto).toBe(60);
  });

  it("A no puede escribir una tarifa en el ámbito de B", async () => {
    // La política tiene `withCheck`, así que ni siquiera insertando a mano con
    // el parqueadero_id de B desde el ámbito de A pasa.
    await expect(
      conAmbito(idA, (tx) =>
        tx.insert(tarifa).values({
          parqueaderoId: idB,
          tipoVehiculoId: tipoId,
          modelo: "por_minuto",
          alcancePlena: "jornada",
          tarifaPlena: 1,
          tarifaMinima: 1,
          valorMinuto: 1,
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("el intento queda registrado (SC-002)", () => {
  it("anota la cuenta, el recurso y el ámbito desde el que se intentó", async () => {
    await expect(
      errorDeAlcance(comoAdminDe(idA), `tarifa:${idB}`),
    ).resolves.toBeInstanceOf(Error);

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado),
    );

    expect(asientos).toHaveLength(1);
    expect(asientos[0]!.usuarioId).toBe("u-aisl-tarifas");
    expect(asientos[0]!.recurso).toBe(`tarifa:${idB}`);
    expect(asientos[0]!.parqueaderoAmbito).toBe(idA);
  });

  it("cuenta cada intento por separado, para que un sondeo se note", async () => {
    for (const recurso of ["tarifa:x", "tarifa:y", "tarifa:z"]) {
      await errorDeAlcance(comoAdminDe(idA), recurso);
    }

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado),
    );
    expect(asientos).toHaveLength(3);
  });
});
