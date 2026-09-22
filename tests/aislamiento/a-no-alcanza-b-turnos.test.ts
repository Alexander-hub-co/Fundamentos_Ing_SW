import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import {
  accesoDenegado,
  parqueadero,
  turno,
  turnoAsignacion,
  turnoDia,
  usuario,
} from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { asignarATurno, crearTurno } from "@/dominio/turnos/gestionar";
import { turnosDelEstablecimiento } from "@/dominio/turnos/consultar";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import type { Contexto } from "@/lib/sesion";

/** Prueba negativa del Principio I sobre turnos, sus días y sus asignaciones. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-aisl-t", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-t",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

let idA: string;
let idB: string;

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${turnoAsignacion}`);
    await tx.execute(sql`delete from ${turnoDia}`);
    await tx.execute(sql`delete from ${turno}`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from session`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-aisl-t", name: "Admin", email: "aisl-t@ejemplo.co" });
  });
}

beforeEach(async () => {
  await limpiar();
  idA = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Alfa T" })).id;
  idB = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Beta T" })).id;

  const suyo = await crearCuenta(ADMIN, {
    email: "gente.b@ejemplo.co",
    nombre: "Gente de B",
    passwordTemporal: "ClaveLargaSegura2026",
    rol: "operario",
    parqueaderoId: idB,
  });

  const t = await crearTurno(comoAdminDe(idB), {
    nombre: "Turno de B",
    horaInicio: "07:00",
    horaFin: "15:00",
    dias: [1, 2, 3],
  });
  await asignarATurno(comoAdminDe(idB), t.id, suyo.usuarioId);
});

afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("A no alcanza los turnos de B", () => {
  it("la consulta de dominio desde A no devuelve nada", async () => {
    expect(await turnosDelEstablecimiento(comoAdminDe(idA))).toEqual([]);
  });

  it("las tres tablas están cerradas al ámbito de A", async () => {
    expect(await conAmbito(idA, (tx) => tx.select().from(turno))).toEqual([]);
    expect(await conAmbito(idA, (tx) => tx.select().from(turnoDia))).toEqual([]);
    expect(await conAmbito(idA, (tx) => tx.select().from(turnoAsignacion))).toEqual([]);
  });

  it("y B sí ve lo suyo, para descartar que todo devuelva vacío", async () => {
    const turnos = await turnosDelEstablecimiento(comoAdminDe(idB));
    expect(turnos).toHaveLength(1);
    expect(turnos[0]!.personas).toHaveLength(1);
  });

  it("A no puede crear un turno en el ámbito de B", async () => {
    await expect(
      conAmbito(idA, (tx) =>
        tx.insert(turno).values({
          parqueaderoId: idB,
          nombre: "Intruso",
          horaInicio: "01:00",
          horaFin: "02:00",
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("el intento queda registrado (SC-002)", () => {
  it("anota el recurso y el ámbito desde el que se intentó", async () => {
    await errorDeAlcance(comoAdminDe(idA), `turno:${idB}`);

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado),
    );

    expect(asientos).toHaveLength(1);
    expect(asientos[0]!.recurso).toBe(`turno:${idB}`);
    expect(asientos[0]!.parqueaderoAmbito).toBe(idA);
  });
});
