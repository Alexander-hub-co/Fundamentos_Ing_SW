import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { accesoDenegado, asignacion, parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import {
  cambiarRolEnMiEstablecimiento,
  gestionarCuentaDeMiEstablecimiento,
  miEquipo,
} from "@/dominio/cuentas/en-establecimiento";
import { RecursoNoAlcanzable } from "@/lib/errores";
import type { Contexto } from "@/lib/sesion";

/**
 * Prueba negativa del Principio I sobre el equipo.
 *
 * Es el caso con más consecuencias de todos: si A alcanzara las cuentas de B,
 * podría bloquear a su gente o cambiarle la contraseña. Por eso se comprueba
 * tanto la lectura como cada una de las escrituras.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-aisl-eq", rol: "admin_general" };
const CLAVE = "ClaveLargaSegura2026";

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-eq",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

let idA: string;
let idB: string;
let genteDeB: string;

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from session`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-aisl-eq", name: "Admin", email: "aisl-eq@ejemplo.co" });
  });
}

beforeEach(async () => {
  await limpiar();
  idA = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Alfa EQ" })).id;
  idB = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Beta EQ" })).id;

  genteDeB = (
    await crearCuenta(ADMIN, {
      email: "solo.de.b@ejemplo.co",
      nombre: "Persona de B",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: idB,
    })
  ).usuarioId;
});

afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("A no alcanza el equipo de B", () => {
  it("no lo ve en su listado", async () => {
    expect(await miEquipo(comoAdminDe(idA))).toEqual([]);
    expect(await miEquipo(comoAdminDe(idB))).toHaveLength(1);
  });

  it("las asignaciones de B no se ven yendo directo a la tabla desde A", async () => {
    expect(await conAmbito(idA, (tx) => tx.select().from(asignacion))).toEqual([]);
  });

  it("no puede bloquear a alguien de B", async () => {
    await expect(
      gestionarCuentaDeMiEstablecimiento(comoAdminDe(idA), "bloquear", { usuarioId: genteDeB }),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("no puede restablecerle la contraseña", async () => {
    await expect(
      gestionarCuentaDeMiEstablecimiento(comoAdminDe(idA), "restablecer", {
        usuarioId: genteDeB,
        passwordTemporal: "OtraClaveLarga2026",
      }),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("no puede darlo de baja ni cambiarle el rol", async () => {
    await expect(
      gestionarCuentaDeMiEstablecimiento(comoAdminDe(idA), "dar_de_baja", { usuarioId: genteDeB }),
    ).rejects.toThrow(RecursoNoAlcanzable);
    await expect(
      cambiarRolEnMiEstablecimiento(comoAdminDe(idA), genteDeB, "admin_parqueadero"),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("la cuenta de B sigue intacta después de todos los intentos", async () => {
    const [antes] = await miEquipo(comoAdminDe(idB));
    for (const accion of ["bloquear", "dar_de_baja"] as const) {
      await gestionarCuentaDeMiEstablecimiento(comoAdminDe(idA), accion, {
        usuarioId: genteDeB,
      }).catch(() => {});
    }
    const [despues] = await miEquipo(comoAdminDe(idB));

    expect(despues!.bloqueada).toBe(antes!.bloqueada);
    expect(despues!.anonimizadaEn).toEqual(antes!.anonimizadaEn);
  });
});

describe("el intento queda registrado (SC-002)", () => {
  it("anota un asiento por cada intento fallido", async () => {
    for (const accion of ["bloquear", "desbloquear", "dar_de_baja"] as const) {
      await gestionarCuentaDeMiEstablecimiento(comoAdminDe(idA), accion, {
        usuarioId: genteDeB,
      }).catch(() => {});
    }

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado),
    );

    expect(asientos).toHaveLength(3);
    expect(asientos.every((a) => a.recurso === `cuenta:${genteDeB}`)).toBe(true);
    expect(asientos.every((a) => a.parqueaderoAmbito === idA)).toBe(true);
  });
});
