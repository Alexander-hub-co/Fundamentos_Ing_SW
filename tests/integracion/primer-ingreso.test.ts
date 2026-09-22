import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, cambioEstado, cuenta as credencial, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { restablecerPassword } from "@/dominio/cuentas/restablecer";
import { iniciarSesion } from "@/dominio/autenticacion/iniciar-sesion";
import { cambiarPasswordObligatorio, PasswordDebil, LARGO_MINIMO } from "@/dominio/autenticacion/cambio-obligatorio";
import type { Contexto } from "@/lib/sesion";

/**
 * V6 — Con `debeCambiarPassword`, ninguna otra operación es accesible (FR-033).
 *
 * El corte ocurre en la resolución del contexto, no en cada pantalla: así no
 * depende de que alguien se acuerde de comprobarlo en la próxima que escriba.
 */

const ADMIN_GENERAL: Contexto = { tipo: "plataforma", usuarioId: "u-general", rol: "admin_general" };
const TEMPORAL = "TemporalSegura2026";
const PROPIA = "MiClavePropia2026";

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

async function cuentaNueva(email = "nuevo@ejemplo.co") {
  const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Central" });
  const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
    email, nombre: "Persona Nueva", passwordTemporal: TEMPORAL,
    rol: "operario", parqueaderoId: p.id,
  });
  return usuarioId;
}

describe("la cuenta nace obligada a cambiar la contraseña", () => {
  it("iniciar sesión devuelve debe_cambiar_password, no ok", async () => {
    await cuentaNueva();
    const r = await iniciarSesion({ email: "nuevo@ejemplo.co", password: TEMPORAL });
    expect(r.tipo).toBe("debe_cambiar_password");
  });

  it("la marca está puesta en la base", async () => {
    const usuarioId = await cuentaNueva();
    const [u] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)));
    expect(u!.debeCambiarPassword).toBe(true);
  });
});

describe("tras cambiarla, el acceso queda habilitado", () => {
  it("la marca baja y el inicio de sesión devuelve ok", async () => {
    const usuarioId = await cuentaNueva("cambia@ejemplo.co");
    await cambiarPasswordObligatorio({ usuarioId, nuevaPassword: PROPIA });

    const [u] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)));
    expect(u!.debeCambiarPassword).toBe(false);

    const r = await iniciarSesion({ email: "cambia@ejemplo.co", password: PROPIA });
    expect(r.tipo).toBe("ok");
  });

  it("la contraseña temporal deja de servir", async () => {
    const usuarioId = await cuentaNueva("vieja@ejemplo.co");
    await cambiarPasswordObligatorio({ usuarioId, nuevaPassword: PROPIA });

    const r = await iniciarSesion({ email: "vieja@ejemplo.co", password: TEMPORAL });
    expect(r.tipo).toBe("credenciales_invalidas");
  });
});

describe("la contraseña nueva tiene exigencia mínima", () => {
  it("rechaza una demasiado corta", async () => {
    const usuarioId = await cuentaNueva("corta@ejemplo.co");
    await expect(
      cambiarPasswordObligatorio({ usuarioId, nuevaPassword: "abc" }),
    ).rejects.toThrow(PasswordDebil);
  });

  it("acepta una del largo mínimo", async () => {
    const usuarioId = await cuentaNueva("justa@ejemplo.co");
    await expect(
      cambiarPasswordObligatorio({ usuarioId, nuevaPassword: "a".repeat(LARGO_MINIMO) }),
    ).resolves.toBeUndefined();
  });
});

describe("restablecer vuelve a exigir el cambio (FR-034)", () => {
  it("tras el restablecimiento, la marca vuelve a subir", async () => {
    const usuarioId = await cuentaNueva("reset@ejemplo.co");
    await cambiarPasswordObligatorio({ usuarioId, nuevaPassword: PROPIA });

    await restablecerPassword(ADMIN_GENERAL, { usuarioId, passwordTemporal: "OtraTemporal2026" });

    const [u] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)));
    expect(u!.debeCambiarPassword).toBe(true);

    const r = await iniciarSesion({ email: "reset@ejemplo.co", password: "OtraTemporal2026" });
    expect(r.tipo).toBe("debe_cambiar_password");
  });

  it("revoca las sesiones abiertas con la contraseña vieja", async () => {
    const usuarioId = await cuentaNueva("sesiones@ejemplo.co");
    await comoPlataforma("administracion_plataforma", (tx) =>
      tx.insert(sesion).values({
        id: "s-r", token: "tok-r", userId: usuarioId,
        expiresAt: new Date(Date.now() + 3_600_000),
      }));

    const { sesionesRevocadas } = await restablecerPassword(ADMIN_GENERAL, {
      usuarioId, passwordTemporal: "OtraMas2026",
    });
    expect(sesionesRevocadas).toBe(1);
  });
});
