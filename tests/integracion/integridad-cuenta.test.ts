import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, cambioEstado, cuenta as credencial, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { darDeBajaCuenta } from "@/dominio/cuentas/dar-de-baja";
import { anonimizarCuenta } from "@/dominio/cuentas/anonimizar";
import type { Contexto } from "@/lib/sesion";

/**
 * Verificación del Principio IV sobre cuentas.
 *
 * Dar de baja o anonimizar una cuenta NO elimina su fila ni rompe ninguna
 * referencia histórica. Si lo hiciera, los asientos que dicen quién cambió qué
 * estado quedarían huérfanos y el historial dejaría de servir como prueba.
 */

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

describe("dar de baja una cuenta no la destruye (FR-038, FR-042)", () => {
  it("la fila sobrevive, sólo pierde el acceso", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Central" });
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "baja@ejemplo.co", nombre: "De Baja", passwordTemporal: CLAVE,
      rol: "operario", parqueaderoId: p.id,
    });

    await darDeBajaCuenta(ADMIN_GENERAL, { usuarioId, motivo: "Renunció" });

    const [tras] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)));

    expect(tras).toBeDefined();
    expect(tras!.banned).toBe(true);
    expect(tras!.name).toBe("De Baja");
  });

  it("retira la asignación: la cuenta deja de pertenecer al establecimiento", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Central" });
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "baja2@ejemplo.co", nombre: "De Baja 2", passwordTemporal: CLAVE,
      rol: "operario", parqueaderoId: p.id,
    });

    await darDeBajaCuenta(ADMIN_GENERAL, { usuarioId });

    const vinculos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(asignacion).where(eq(asignacion.usuarioId, usuarioId)));
    expect(vinculos).toHaveLength(0);
  });
});

describe("los asientos del historial nunca quedan huérfanos", () => {
  it("un cambio de estado ejecutado por una cuenta sobrevive a su anonimización", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Con historia" });
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "ejecutor@ejemplo.co", nombre: "Ejecutor", passwordTemporal: CLAVE,
      rol: "admin_parqueadero", parqueaderoId: p.id,
    });

    // El administrador general deja un asiento en el historial.
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id, nuevoEstado: "suspendido", motivo: "Impago",
    });

    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(cambioEstado).where(eq(cambioEstado.parqueaderoId, p.id)));

    expect(asientos).toHaveLength(1);
    expect(asientos[0]!.ejecutadoPor).toBe("u-general");
  });

  it("la base rechaza borrar una cuenta referenciada por el historial", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Referenciada" });
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id, nuevoEstado: "suspendido", motivo: "Impago",
    });

    const error = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`delete from ${usuario} where id = 'u-general'`),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);

    const [sigue] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, "u-general")));
    expect(sigue).toBeDefined();
  });
});
