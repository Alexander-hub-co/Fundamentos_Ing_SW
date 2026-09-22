import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { crearCuenta } from "@/dominio/cuentas/crear";
import {
  cambiarRolEnMiEstablecimiento,
  crearCuentaEnMiEstablecimiento,
  gestionarCuentaDeMiEstablecimiento,
  miEquipo,
} from "@/dominio/cuentas/en-establecimiento";
import { AmbitoInvalido } from "@/dominio/cuentas/crear";
import { RecursoNoAlcanzable } from "@/lib/errores";
import { EstablecimientoRestringido } from "@/lib/autorizacion";
import type { EstadoParqueadero, RolUsuario } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/** Historia 3 — el establecimiento arma su equipo sin pasar por la plataforma. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-eq", rol: "admin_general" };
const CLAVE = "ClaveLargaSegura2026";

const comoAdminDe = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-eq",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado,
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from session`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-eq", name: "Admin", email: "eq@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("dar de alta gente del propio establecimiento", () => {
  it("queda vinculada, con código legible y contraseña temporal", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Equipo" });

    const creada = await crearCuentaEnMiEstablecimiento(comoAdminDe(p.id), {
      email: "operario.nuevo@ejemplo.co",
      nombre: "Operario Nuevo",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    expect(creada.codigo).toMatch(/^[A-Z]{3}\d?-\d{3}$/);

    const equipo = await miEquipo(comoAdminDe(p.id));
    expect(equipo).toHaveLength(1);
    expect(equipo[0]!.debeCambiarPassword).toBe(true);
  });

  it("rechaza crear una cuenta de plataforma", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Sin Plataforma" });

    await expect(
      crearCuentaEnMiEstablecimiento(comoAdminDe(p.id), {
        email: "intruso@ejemplo.co",
        nombre: "Intruso",
        passwordTemporal: CLAVE,
        rol: "admin_general" as unknown as "operario",
      }),
    ).rejects.toThrow(AmbitoInvalido);
  });

  it("el establecimiento no se recibe por parámetro: sale de la sesión", async () => {
    const propio = await crearParqueadero(ADMIN, { nombre: "Parqueadero Propio Eq" });
    const ajeno = await crearParqueadero(ADMIN, { nombre: "Parqueadero Ajeno Eq" });

    await crearCuentaEnMiEstablecimiento(comoAdminDe(propio.id), {
      email: "queda.en.propio@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    expect(await miEquipo(comoAdminDe(propio.id))).toHaveLength(1);
    expect(await miEquipo(comoAdminDe(ajeno.id))).toEqual([]);
  });
});

describe("ascender a administrador dentro del local", () => {
  it("amplía el rol sin cambiar de establecimiento", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Ascenso" });
    const ctx = comoAdminDe(p.id);
    const persona = await crearCuentaEnMiEstablecimiento(ctx, {
      email: "encargado@ejemplo.co",
      nombre: "Encargado",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    await cambiarRolEnMiEstablecimiento(ctx, persona.usuarioId, "admin_parqueadero");

    const equipo = await miEquipo(ctx);
    expect(equipo[0]!.rol as RolUsuario).toBe("admin_parqueadero");
  });

  it("no alcanza a alguien de otro establecimiento", async () => {
    const propio = await crearParqueadero(ADMIN, { nombre: "Parqueadero A Eq" });
    const ajeno = await crearParqueadero(ADMIN, { nombre: "Parqueadero B Eq" });
    const deAjeno = await crearCuenta(ADMIN, {
      email: "de.ajeno@ejemplo.co",
      nombre: "Ajeno",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: ajeno.id,
    });

    await expect(
      cambiarRolEnMiEstablecimiento(comoAdminDe(propio.id), deAjeno.usuarioId, "admin_parqueadero"),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });
});

describe("gestionar las cuentas propias", () => {
  it("bloquea y desbloquea a alguien del equipo", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Bloqueo Eq" });
    const ctx = comoAdminDe(p.id);
    const persona = await crearCuentaEnMiEstablecimiento(ctx, {
      email: "bloqueable@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    await gestionarCuentaDeMiEstablecimiento(ctx, "bloquear", {
      usuarioId: persona.usuarioId,
      motivo: "no vino a trabajar",
    });
    expect((await miEquipo(ctx))[0]!.bloqueada).toBe(true);

    await gestionarCuentaDeMiEstablecimiento(ctx, "desbloquear", { usuarioId: persona.usuarioId });
    expect((await miEquipo(ctx))[0]!.bloqueada).toBe(false);
  });

  it("restablece la contraseña y vuelve a exigir el cambio", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Reset Eq" });
    const ctx = comoAdminDe(p.id);
    const persona = await crearCuentaEnMiEstablecimiento(ctx, {
      email: "reseteable@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    await gestionarCuentaDeMiEstablecimiento(ctx, "restablecer", {
      usuarioId: persona.usuarioId,
      passwordTemporal: "OtraClaveLarga2026",
    });

    expect((await miEquipo(ctx))[0]!.debeCambiarPassword).toBe(true);
  });

  it("no alcanza una cuenta ajena, y responde como si no existiera", async () => {
    const propio = await crearParqueadero(ADMIN, { nombre: "Parqueadero C Eq" });
    const ajeno = await crearParqueadero(ADMIN, { nombre: "Parqueadero D Eq" });
    const deAjeno = await crearCuenta(ADMIN, {
      email: "otro.ajeno@ejemplo.co",
      nombre: "Ajeno",
      passwordTemporal: CLAVE,
      rol: "operario",
      parqueaderoId: ajeno.id,
    });

    await expect(
      gestionarCuentaDeMiEstablecimiento(comoAdminDe(propio.id), "bloquear", {
        usuarioId: deAjeno.usuarioId,
      }),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("una contraseña corta se sigue rechazando también por esta vía", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Corta Eq" });
    const ctx = comoAdminDe(p.id);
    const persona = await crearCuentaEnMiEstablecimiento(ctx, {
      email: "corta.eq@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    await expect(
      gestionarCuentaDeMiEstablecimiento(ctx, "restablecer", {
        usuarioId: persona.usuarioId,
        passwordTemporal: "123",
      }),
    ).rejects.toThrow();
  });
});

describe("el establecimiento suspendido", () => {
  it("rechaza el alta y permite consultar el equipo (SC-005)", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Eq Suspenso" });
    await crearCuentaEnMiEstablecimiento(comoAdminDe(p.id), {
      email: "previo@ejemplo.co",
      nombre: "Previo",
      passwordTemporal: CLAVE,
      rol: "operario",
    });

    await cambiarEstadoParqueadero(ADMIN, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "prueba de modo restringido",
    });

    const suspendido = comoAdminDe(p.id, "suspendido");

    await expect(
      crearCuentaEnMiEstablecimiento(suspendido, {
        email: "nuevo@ejemplo.co",
        nombre: "Nuevo",
        passwordTemporal: CLAVE,
        rol: "operario",
      }),
    ).rejects.toThrow(EstablecimientoRestringido);

    expect(await miEquipo(suspendido)).toHaveLength(1);
  });
});
