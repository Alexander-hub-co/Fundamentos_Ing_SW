import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, cambioEstado, cuenta as credencial, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { anonimizarCuenta } from "@/dominio/cuentas/anonimizar";
import { obtenerResumenPlataforma } from "@/dominio/plataforma/resumen";
import { NoAutorizado } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/** Historia 5 — Panel global del estado de la plataforma. */

const ADMIN_GENERAL: Contexto = { tipo: "plataforma", usuarioId: "u-general", rol: "admin_general" };
const CLAVE = "TemporalSegura2026";

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    await tx.execute(sql`delete from ${credencial}`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${cambioEstado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-general", name: "Admin General", email: "general@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => { await limpiar(); await cerrarPools(); });

/** Crea un establecimiento y lo lleva al estado indicado. */
async function establecimientoEn(nombre: string, estado: "activo" | "pendiente" | "suspendido" | "dado_de_baja") {
  const p = await crearParqueadero(ADMIN_GENERAL, { nombre });
  if (estado !== "activo") {
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id, nuevoEstado: estado, motivo: "Preparación de la prueba",
    });
  }
  return p;
}

describe("escenario 1 — un contador por cada uno de los cuatro estados (FR-049)", () => {
  it("cuenta correctamente con establecimientos en todos los estados", async () => {
    await establecimientoEn("A", "activo");
    await establecimientoEn("B", "activo");
    await establecimientoEn("C", "pendiente");
    await establecimientoEn("D", "suspendido");
    await establecimientoEn("E", "dado_de_baja");

    const r = await obtenerResumenPlataforma(ADMIN_GENERAL);

    expect(r.establecimientos.activo).toBe(2);
    expect(r.establecimientos.pendiente).toBe(1);
    expect(r.establecimientos.suspendido).toBe(1);
    expect(r.establecimientos.dado_de_baja).toBe(1);
  });

  it("la suma de los cuatro iguala el total registrado", async () => {
    await establecimientoEn("A", "activo");
    await establecimientoEn("B", "suspendido");
    await establecimientoEn("C", "dado_de_baja");

    const r = await obtenerResumenPlataforma(ADMIN_GENERAL);
    const suma = Object.values(r.establecimientos).reduce((a, b) => a + b, 0);

    expect(suma).toBe(r.totalEstablecimientos);
    expect(suma).toBe(3);
  });

  it("un estado sin filas muestra 0, no desaparece del panel", async () => {
    await establecimientoEn("Solo activo", "activo");

    const r = await obtenerResumenPlataforma(ADMIN_GENERAL);

    expect(Object.keys(r.establecimientos).sort()).toEqual(
      ["activo", "dado_de_baja", "pendiente", "suspendido"],
    );
    expect(r.establecimientos.suspendido).toBe(0);
    expect(r.establecimientos.dado_de_baja).toBe(0);
  });

  it("sin ningún establecimiento, todos los contadores están en cero", async () => {
    const r = await obtenerResumenPlataforma(ADMIN_GENERAL);
    expect(r.totalEstablecimientos).toBe(0);
    expect(Object.values(r.establecimientos)).toEqual([0, 0, 0, 0]);
  });
});

describe("escenario 2 — los contadores reflejan el cambio de estado", () => {
  it("suspender mueve el establecimiento de un contador al otro", async () => {
    const p = await establecimientoEn("Cambiante", "activo");

    const antes = await obtenerResumenPlataforma(ADMIN_GENERAL);
    expect(antes.establecimientos.activo).toBe(1);
    expect(antes.establecimientos.suspendido).toBe(0);

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id, nuevoEstado: "suspendido", motivo: "Impago",
    });

    const despues = await obtenerResumenPlataforma(ADMIN_GENERAL);
    expect(despues.establecimientos.activo).toBe(0);
    expect(despues.establecimientos.suspendido).toBe(1);
    expect(despues.totalEstablecimientos).toBe(1);
  });
});

describe("escenario 3 — las cuentas anonimizadas no suman al total (FR-050)", () => {
  it("se informan por separado", async () => {
    const p = await establecimientoEn("Con cuentas", "activo");
    const a = await crearCuenta(ADMIN_GENERAL, {
      email: "uno@ejemplo.co", nombre: "Uno", passwordTemporal: CLAVE,
      rol: "operario", parqueaderoId: p.id,
    });
    await crearCuenta(ADMIN_GENERAL, {
      email: "dos@ejemplo.co", nombre: "Dos", passwordTemporal: CLAVE,
      rol: "operario", parqueaderoId: p.id,
    });

    const antes = await obtenerResumenPlataforma(ADMIN_GENERAL);
    expect(antes.cuentas).toBe(3); // las dos nuevas y el administrador general
    expect(antes.cuentasAnonimizadas).toBe(0);

    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId: a.usuarioId, confirmado: true });

    const despues = await obtenerResumenPlataforma(ADMIN_GENERAL);
    expect(despues.cuentas).toBe(2);
    expect(despues.cuentasAnonimizadas).toBe(1);
  });
});

describe("el panel es una operación de plataforma", () => {
  it("un administrador de parqueadero no puede consultarlo", async () => {
    const contexto: Contexto = {
      tipo: "establecimiento", usuarioId: "u-x", rol: "admin_parqueadero",
      parqueaderoId: "00000000-0000-0000-0000-000000000000", estado: "activo",
    };
    await expect(obtenerResumenPlataforma(contexto)).rejects.toThrow(NoAutorizado);
  });
});
