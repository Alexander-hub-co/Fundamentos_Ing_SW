import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import type { Contexto } from "@/lib/sesion";

/**
 * Códigos legibles de cuenta.
 *
 * El objetivo del formato es que quien administra varios establecimientos
 * distinga a su gente de un vistazo, así que lo que se verifica no es sólo la
 * unicidad sino que el código diga a qué local pertenece.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-general",
  rol: "admin_general",
};

const CLAVE = "TemporalSegura2026";

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-general",
      name: "Admin General",
      email: "general@ejemplo.co",
    });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  // Limpiar también al terminar, no sólo antes de cada prueba: las cuentas que
  // este archivo crea tienen fila en `account`, y otro archivo que borre
  // `user` sin borrarlas antes falla por clave foránea.
  await limpiar();
  await cerrarPools();
});

describe("código legible de cuenta", () => {
  it("numera bajo la sigla del establecimiento, empezando en 001", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, {
      nombre: "Parqueadero Centro Historico",
    });

    const admin = await crearCuenta(ADMIN_GENERAL, {
      email: "ana@ejemplo.co",
      nombre: "Ana Gómez",
      passwordTemporal: CLAVE,
      rol: "admin_parqueadero",
      parqueaderoId: p.id,
    });
    const operario = await crearCuenta(ADMIN_GENERAL, {
      email: "luis@ejemplo.co",
      nombre: "Luis Martínez",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    expect(admin.codigo).toBe("PCH-001");
    expect(operario.codigo).toBe("PCH-002");
  });

  it("numera cada establecimiento por su cuenta, sin correlativo global", async () => {
    const centro = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero El Centro" });
    const norte = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Zona Norte" });

    const unoCentro = await crearCuenta(ADMIN_GENERAL, {
      email: "c1@ejemplo.co",
      nombre: "Persona Centro",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: centro.id,
    });
    const unoNorte = await crearCuenta(ADMIN_GENERAL, {
      email: "n1@ejemplo.co",
      nombre: "Persona Norte",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: norte.id,
    });

    expect(unoCentro.codigo).toBe("PEC-001");
    expect(unoNorte.codigo).toBe("PZN-001");
  });

  it("da a los administradores generales la sigla de la plataforma", async () => {
    const creada = await crearCuenta(ADMIN_GENERAL, {
      email: "otro.general@ejemplo.co",
      nombre: "Otro General",
      passwordTemporal: CLAVE,
      rol: "admin_general",
      parqueaderoId: null,
    });

    expect(creada.codigo).toMatch(/^PQV-\d{3}$/);
  });

  it("no reutiliza un número aunque las altas ocurran a la vez", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Simultaneo" });

    const creadas = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        crearCuenta(ADMIN_GENERAL, {
          email: `simultaneo${n}@ejemplo.co`,
          nombre: `Persona ${n}`,
          passwordTemporal: CLAVE,
          rol: "operario",
          parqueaderoId: p.id,
        }),
      ),
    );

    const codigos = creadas.map((c) => c.codigo).sort();
    expect(new Set(codigos).size).toBe(5);
    expect(codigos).toEqual(["PSI-001", "PSI-002", "PSI-003", "PSI-004", "PSI-005"]);
  });
});
