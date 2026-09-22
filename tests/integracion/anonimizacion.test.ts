import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import {
  asignacion,
  cambioEstado,
  cuenta as credencial,
  parqueadero,
  sesion,
  usuario,
} from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import {
  anonimizarCuenta,
  AnonimizacionRequiereConfirmacion,
  YaAnonimizada,
} from "@/dominio/cuentas/anonimizar";
import { pareceAnonimizado } from "@/dominio/cuentas/datos-personales";
import { iniciarSesion } from "@/dominio/autenticacion/iniciar-sesion";
import type { Contexto } from "@/lib/sesion";

/**
 * V8 — Anonimización que no rompe el histórico (FR-044 a FR-046).
 *
 * Concilia dos obligaciones que parecían incompatibles: el titular puede exigir
 * que sus datos desaparezcan, y el Principio IV prohíbe destruir el historial.
 * La salida es sustituir en vez de borrar.
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
    await tx.execute(sql`delete from ${credencial}`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${cambioEstado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
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
  await limpiar();
  await cerrarPools();
});

async function cuentaDePrueba(email = "titular@ejemplo.co") {
  const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Central" });
  const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
    email,
    nombre: "María Pérez",
    passwordTemporal: CLAVE,
    rol: "operario",
    parqueaderoId: p.id,
  });
  return { usuarioId, parqueaderoId: p.id };
}

describe("los datos personales dejan de ser recuperables (FR-044)", () => {
  it("nombre, correo e imagen quedan sustituidos", async () => {
    const { usuarioId } = await cuentaDePrueba();

    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });

    const [tras] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)),
    );

    expect(pareceAnonimizado(tras!)).toBe(true);
    expect(tras!.name).not.toContain("María");
    expect(tras!.email).not.toContain("titular");
    expect(tras!.anonimizadaEn).toBeInstanceOf(Date);
  });

  it("dos cuentas anonimizadas no chocan entre sí", async () => {
    const a = await cuentaDePrueba("uno@ejemplo.co");
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Otro" });
    const b = await crearCuenta(ADMIN_GENERAL, {
      email: "dos@ejemplo.co",
      nombre: "Otro Titular",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId: a.usuarioId, confirmado: true });
    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId: b.usuarioId, confirmado: true });

    const correos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select({ email: usuario.email }).from(usuario),
    );
    expect(new Set(correos.map((c) => c.email)).size).toBe(correos.length);
  });
});

describe("la cuenta anonimizada no puede autenticarse (FR-046)", () => {
  it("las credenciales fueron eliminadas", async () => {
    const { usuarioId } = await cuentaDePrueba();
    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });

    const credenciales = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(credencial).where(eq(credencial.userId, usuarioId)),
    );
    expect(credenciales).toHaveLength(0);
  });

  it("el inicio de sesión con la contraseña vieja falla", async () => {
    await cuentaDePrueba("login@ejemplo.co");
    const [u] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.email, "login@ejemplo.co")),
    );

    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId: u!.id, confirmado: true });

    const r = await iniciarSesion({ email: "login@ejemplo.co", password: CLAVE });
    expect(r.tipo).toBe("credenciales_invalidas");
  });
});

describe("las referencias históricas sobreviven (FR-045, Principio IV)", () => {
  it("la fila conserva su identificador", async () => {
    const { usuarioId } = await cuentaDePrueba();
    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });

    const [tras] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, usuarioId)),
    );
    expect(tras!.id).toBe(usuarioId);
  });

  it("la asignación que la referencia sigue existiendo", async () => {
    const { usuarioId } = await cuentaDePrueba();
    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });

    const vinculos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(asignacion).where(eq(asignacion.usuarioId, usuarioId)),
    );
    expect(vinculos).toHaveLength(1);
  });

  it("la base impide borrar físicamente una cuenta con historial", async () => {
    const { usuarioId } = await cuentaDePrueba();
    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });

    // El intento debe fallar por la clave foránea: es la garantía de FR-042
    // impuesta por la base, no por el código.
    const error = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`delete from ${usuario} where id = ${usuarioId}`),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
  });
});

describe("es una acción deliberada e irrepetible", () => {
  it("sin confirmar, se rechaza", async () => {
    const { usuarioId } = await cuentaDePrueba();
    await expect(anonimizarCuenta(ADMIN_GENERAL, { usuarioId })).rejects.toThrow(
      AnonimizacionRequiereConfirmacion,
    );
  });

  it("no se puede anonimizar dos veces", async () => {
    const { usuarioId } = await cuentaDePrueba();
    await anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true });
    await expect(
      anonimizarCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true }),
    ).rejects.toThrow(YaAnonimizada);
  });
});
