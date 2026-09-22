import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { desc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { accesoDenegado, asignacion, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { bloquearCuenta } from "@/dominio/cuentas/bloqueo";
import { RecursoNoAlcanzable } from "@/lib/errores";
import type { Contexto } from "@/lib/sesion";

/**
 * FR-005 — cada intento de acceso fuera de ámbito deja rastro.
 *
 * Lo que se verifica no es que la petición sea denegada —de eso se encargan las
 * pruebas V1 a V5— sino que quede el asiento. Sin él, nadie puede notar que
 * alguien está probando identificadores ajenos.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-auditor",
  rol: "admin_general",
};

const INEXISTENTE = "00000000-0000-0000-0000-0000000000ff";

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-auditor",
      name: "Auditor",
      email: "auditor@ejemplo.co",
    });
  });
}

async function asientos() {
  return comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(accesoDenegado).orderBy(desc(accesoDenegado.ocurridoEn)),
  );
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("registro de accesos denegados", () => {
  it("anota la cuenta, el recurso y el momento", async () => {
    await expect(
      cambiarEstadoParqueadero(ADMIN_GENERAL, {
        parqueaderoId: INEXISTENTE,
        nuevoEstado: "suspendido",
        motivo: "prueba de sondeo",
      }),
    ).rejects.toThrow(RecursoNoAlcanzable);

    const filas = await asientos();
    expect(filas).toHaveLength(1);
    expect(filas[0]!.usuarioId).toBe("u-auditor");
    expect(filas[0]!.recurso).toBe(`parqueadero:${INEXISTENTE}`);
    expect(filas[0]!.ocurridoEn).toBeInstanceOf(Date);
  });

  it("sobrevive a la transacción que se deshace al denegar", async () => {
    // La denegación ocurre dentro de una transacción que se revierte. Si el
    // asiento compartiera esa transacción, desaparecería con ella.
    await expect(
      bloquearCuenta(ADMIN_GENERAL, { usuarioId: "u-inexistente", confirmado: true }),
    ).rejects.toThrow(RecursoNoAlcanzable);

    const filas = await asientos();
    expect(filas).toHaveLength(1);
    expect(filas[0]!.recurso).toBe("cuenta:u-inexistente");
  });

  it("cuenta cada intento por separado, para que un sondeo se note", async () => {
    for (const id of ["a", "b", "c"]) {
      await expect(
        bloquearCuenta(ADMIN_GENERAL, { usuarioId: `sonda-${id}`, confirmado: true }),
      ).rejects.toThrow(RecursoNoAlcanzable);
    }

    const filas = await asientos();
    expect(filas).toHaveLength(3);
    expect(filas.map((f) => f.recurso).sort()).toEqual([
      "cuenta:sonda-a",
      "cuenta:sonda-b",
      "cuenta:sonda-c",
    ]);
  });

  it("no anota nada cuando el recurso sí se alcanza", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Legitimo" });

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "operación normal, no debe auditarse como denegación",
    });

    expect(await asientos()).toHaveLength(0);
  });
});
