import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import {
  accesoDenegado,
  capacidad,
  horarioAtencion,
  horarioFranja,
  parqueadero,
  tipoVehiculo,
  usuario,
} from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararHorario } from "@/dominio/horarios/declarar";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { capacidadDeclarada, declararCapacidad } from "@/dominio/capacidad/declarar";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import type { Contexto } from "@/lib/sesion";

/** Prueba negativa del Principio I sobre horario y capacidad. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-aisl-hc", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-hc",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

let idA: string;
let idB: string;

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from horario_franja`);
    await tx.execute(sql`delete from horario_atencion`);
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-aisl-hc", name: "Admin", email: "aisl-hc@ejemplo.co" });
  });
}

beforeEach(async () => {
  await limpiar();
  idA = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Alfa HC" })).id;
  idB = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Beta HC" })).id;

  const [tipo] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)).limit(1),
  );

  await declararHorario(comoAdminDe(idB), {
    abierto24h: false,
    cobraHorasCerradas: true,
    franjas: [{ diaSemana: 1, horaApertura: "06:00", horaCierre: "22:00" }],
  });
  await declararCapacidad(comoAdminDe(idB), tipo!.id, 99);
});

afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("A no alcanza el horario ni la capacidad de B", () => {
  it("el horario de B no se ve desde A", async () => {
    const h = await horarioDelCobro(comoAdminDe(idA));
    // Sin horario propio, A cae en el supuesto por defecto: nunca ve el de B.
    expect(h.abierto24h).toBe(true);
    expect(h.franjas).toEqual([]);
  });

  it("las franjas de B no se ven yendo directo a la tabla desde A", async () => {
    expect(await conAmbito(idA, (tx) => tx.select().from(horarioFranja))).toEqual([]);
    expect(await conAmbito(idA, (tx) => tx.select().from(horarioAtencion))).toEqual([]);
  });

  it("la capacidad de B no se ve desde A", async () => {
    expect(await capacidadDeclarada(comoAdminDe(idA))).toEqual([]);
    expect(await conAmbito(idA, (tx) => tx.select().from(capacidad))).toEqual([]);
  });

  it("y B sí ve lo suyo, para descartar que todo devuelva vacío", async () => {
    expect((await horarioDelCobro(comoAdminDe(idB))).franjas).toHaveLength(1);
    expect(await capacidadDeclarada(comoAdminDe(idB))).toHaveLength(1);
  });

  it("A no puede escribir capacidad en el ámbito de B", async () => {
    const [tipo] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)).limit(1),
    );

    await expect(
      conAmbito(idA, (tx) =>
        tx.insert(capacidad).values({ parqueaderoId: idB, tipoVehiculoId: tipo!.id, cupos: 1 }),
      ),
    ).rejects.toThrow();
  });
});

describe("el intento queda registrado (SC-002)", () => {
  it("anota el recurso y el ámbito desde el que se intentó", async () => {
    await errorDeAlcance(comoAdminDe(idA), `horario:${idB}`);

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado),
    );

    expect(asientos).toHaveLength(1);
    expect(asientos[0]!.recurso).toBe(`horario:${idB}`);
    expect(asientos[0]!.parqueaderoAmbito).toBe(idA);
  });
});
