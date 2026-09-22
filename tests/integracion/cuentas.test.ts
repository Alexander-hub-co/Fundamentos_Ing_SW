import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { crearCuenta, AmbitoInvalido, CorreoYaRegistrado } from "@/dominio/cuentas/crear";
import { bloquearCuenta, desbloquearCuenta } from "@/dominio/cuentas/bloqueo";
import { darDeBajaCuenta } from "@/dominio/cuentas/dar-de-baja";
import { RequiereConfirmacion } from "@/dominio/cuentas/ultimo-administrador";
import { iniciarSesion } from "@/dominio/autenticacion/iniciar-sesion";
import type { Contexto } from "@/lib/sesion";

/** Historia 4 — Gestionar el acceso y el ciclo de vida de las cuentas. */

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
  await limpiar();
  await cerrarPools();
});

async function establecimiento(nombre = "Central") {
  return crearParqueadero(ADMIN_GENERAL, { nombre });
}

describe("escenario 1 — crear cuenta con rol y ámbito", () => {
  it("la cuenta nace con contraseña temporal y obligada a cambiarla", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "operario@ejemplo.co",
      nombre: "Operario Uno",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    const [creada] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)),
    );

    expect(creada!.debeCambiarPassword).toBe(true);
    expect(creada!.banned).toBe(false);
  });

  it("rechaza un administrador general con establecimiento", async () => {
    const p = await establecimiento();
    await expect(
      crearCuenta(ADMIN_GENERAL, {
        email: "x@ejemplo.co",
        nombre: "X",
        passwordTemporal: CLAVE,
        rol: "admin_general",
        parqueaderoId: p.id,
      }),
    ).rejects.toThrow(AmbitoInvalido);
  });

  it("rechaza un operario sin establecimiento", async () => {
    await expect(
      crearCuenta(ADMIN_GENERAL, {
        email: "y@ejemplo.co",
        nombre: "Y",
        passwordTemporal: CLAVE,
        rol: "operario",
        parqueaderoId: null,
      }),
    ).rejects.toThrow(AmbitoInvalido);
  });

  it("rechaza un correo ya registrado", async () => {
    const p = await establecimiento();
    const datos = {
      email: "repetido@ejemplo.co",
      nombre: "Repetido",
      passwordTemporal: CLAVE,
      rol: "operario" as const,
      parqueaderoId: p.id,
    };
    await crearCuenta(ADMIN_GENERAL, datos);
    await expect(crearCuenta(ADMIN_GENERAL, datos)).rejects.toThrow(CorreoYaRegistrado);
  });
});

describe("escenario 2 — el primer ingreso exige cambiar la contraseña (FR-033)", () => {
  it("iniciarSesion devuelve debe_cambiar_password", async () => {
    const p = await establecimiento();
    await crearCuenta(ADMIN_GENERAL, {
      email: "nuevo@ejemplo.co",
      nombre: "Nuevo",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    const r = await iniciarSesion({ email: "nuevo@ejemplo.co", password: CLAVE });
    expect(r.tipo).toBe("debe_cambiar_password");
  });
});

describe("escenario 4 — la cuenta bloqueada no entra (FR-036)", () => {
  it("tras bloquear, el inicio de sesión se rechaza", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "bloq@ejemplo.co",
      nombre: "Bloqueable",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await bloquearCuenta(ADMIN_GENERAL, { usuarioId, motivo: "Conducta" });

    const r = await iniciarSesion({ email: "bloq@ejemplo.co", password: CLAVE });
    expect(r.tipo).toBe("cuenta_bloqueada");
  });

  it("desbloquear restituye el acceso", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "desbloq@ejemplo.co",
      nombre: "Desbloqueable",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await bloquearCuenta(ADMIN_GENERAL, { usuarioId });
    await desbloquearCuenta(ADMIN_GENERAL, { usuarioId });

    const r = await iniciarSesion({ email: "desbloq@ejemplo.co", password: CLAVE });
    expect(r.tipo).toBe("debe_cambiar_password");
  });
});

describe("escenario 5 — bloquear revoca la sesión en curso (FR-004)", () => {
  it("las sesiones abiertas se eliminan al bloquear", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "consesion@ejemplo.co",
      nombre: "Con Sesión",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await comoPlataforma("administracion_plataforma", (tx) =>
      tx.insert(sesion).values({
        id: "s-x",
        token: "tok-x",
        userId: usuarioId,
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    );

    const { sesionesRevocadas } = await bloquearCuenta(ADMIN_GENERAL, { usuarioId });
    expect(sesionesRevocadas).toBe(1);
  });
});

describe("escenario 6 — protección del último administrador (FR-037)", () => {
  it("bloquear al único administrador exige confirmación", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "unico@ejemplo.co",
      nombre: "Único Admin",
      passwordTemporal: CLAVE,
      rol: "admin_parqueadero",
      parqueaderoId: p.id,
    });

    await expect(bloquearCuenta(ADMIN_GENERAL, { usuarioId })).rejects.toThrow(
      RequiereConfirmacion,
    );

    await expect(
      bloquearCuenta(ADMIN_GENERAL, { usuarioId, confirmado: true }),
    ).resolves.toBeDefined();
  });

  it("con dos administradores no hace falta confirmar", async () => {
    const p = await establecimiento();
    const a = await crearCuenta(ADMIN_GENERAL, {
      email: "admin-a@ejemplo.co",
      nombre: "Admin A",
      passwordTemporal: CLAVE,
      rol: "admin_parqueadero",
      parqueaderoId: p.id,
    });
    await crearCuenta(ADMIN_GENERAL, {
      email: "admin-b@ejemplo.co",
      nombre: "Admin B",
      passwordTemporal: CLAVE,
      rol: "admin_parqueadero",
      parqueaderoId: p.id,
    });

    await expect(
      bloquearCuenta(ADMIN_GENERAL, { usuarioId: a.usuarioId }),
    ).resolves.toBeDefined();
  });

  it("un operario nunca dispara la protección", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "op@ejemplo.co",
      nombre: "Operario",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await expect(bloquearCuenta(ADMIN_GENERAL, { usuarioId })).resolves.toBeDefined();
  });

  it("dar de baja al único administrador también exige confirmación", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "unico2@ejemplo.co",
      nombre: "Único",
      passwordTemporal: CLAVE,
      rol: "admin_parqueadero",
      parqueaderoId: p.id,
    });

    await expect(darDeBajaCuenta(ADMIN_GENERAL, { usuarioId })).rejects.toThrow(
      RequiereConfirmacion,
    );
  });
});

describe("FR-039 — bloqueo de cuenta y suspensión de establecimiento son independientes", () => {
  it("desbloquear la cuenta NO reactiva el establecimiento suspendido", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "indep@ejemplo.co",
      nombre: "Independiente",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await bloquearCuenta(ADMIN_GENERAL, { usuarioId });
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Impago",
    });

    await desbloquearCuenta(ADMIN_GENERAL, { usuarioId });

    const [establecimientoTras] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(parqueadero).where(eq(parqueadero.id, p.id)),
    );
    expect(establecimientoTras!.estado).toBe("suspendido");
  });

  it("reactivar el establecimiento NO desbloquea la cuenta", async () => {
    const p = await establecimiento();
    const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
      email: "indep2@ejemplo.co",
      nombre: "Independiente 2",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Impago",
    });
    await bloquearCuenta(ADMIN_GENERAL, { usuarioId, motivo: "Conducta" });
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "activo",
      motivo: "Pagó",
    });

    const [cuentaTras] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usuario).where(eq(usuario.id, usuarioId)),
    );
    expect(cuentaTras!.banned).toBe(true);
  });
});

describe("el establecimiento dado de baja corta el acceso de sus cuentas", () => {
  it("iniciarSesion devuelve establecimiento_sin_acceso", async () => {
    const p = await establecimiento();
    await crearCuenta(ADMIN_GENERAL, {
      email: "sinacceso@ejemplo.co",
      nombre: "Sin Acceso",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "dado_de_baja",
      motivo: "Cerró",
    });

    const r = await iniciarSesion({ email: "sinacceso@ejemplo.co", password: CLAVE });
    expect(r.tipo).toBe("establecimiento_sin_acceso");
  });
});
