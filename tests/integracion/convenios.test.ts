import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import {
  agregarPlaca,
  ConvenioInvalido,
  conveniosDelEstablecimiento,
  descuentoParaPlaca,
  quitarPlaca,
  declararConvenio,
  vencerConvenio,
} from "@/dominio/convenios/gestionar";
import { EstablecimientoRestringido } from "@/lib/autorizacion";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/** Historia 5 — convenios de descuento. Informan, no cobran. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-cv", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-cv",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado,
});

const AHORA = new Date();

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-cv", name: "Admin", email: "cv@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("registrar un convenio", () => {
  it("informa el descuento de las placas que cubre", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Convenio" });
    const ctx = comoAdminDe(p.id);

    const c = await declararConvenio(ctx, { nombre: "Clínica San José", activacion: "placa", beneficio: "porcentaje", valor: 20 });
    for (const placa of ["ABC123", "def456", "GHI-789"]) {
      await agregarPlaca(ctx, c.id, placa);
    }

    const d = await descuentoParaPlaca(ctx, "abc 123", AHORA);
    expect(d?.valor).toBe(20);
    expect(d?.nombre).toBe("Clínica San José");

    expect((await conveniosDelEstablecimiento(ctx))[0]!.placas).toHaveLength(3);
  });

  it("una placa sin convenio no tiene descuento", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Sin" });
    expect(await descuentoParaPlaca(comoAdminDe(p.id), "XYZ999", AHORA)).toBeNull();
  });

  it("un convenio vencido deja de informar descuento", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Vencido" });
    const ctx = comoAdminDe(p.id);
    const c = await declararConvenio(ctx, { nombre: "Vencido", activacion: "placa", beneficio: "porcentaje", valor: 30 });
    await agregarPlaca(ctx, c.id, "ABC123");

    expect(await descuentoParaPlaca(ctx, "ABC123", AHORA)).not.toBeNull();

    await vencerConvenio(ctx, c.id);
    expect(await descuentoParaPlaca(ctx, "ABC123", AHORA)).toBeNull();
  });

  it("vencer no borra: las placas siguen consultables", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Historia" });
    const ctx = comoAdminDe(p.id);
    const c = await declararConvenio(ctx, { nombre: "Antiguo", activacion: "placa", beneficio: "porcentaje", valor: 10 });
    await agregarPlaca(ctx, c.id, "ABC123");
    await vencerConvenio(ctx, c.id);

    const convenios = await conveniosDelEstablecimiento(ctx);
    expect(convenios).toHaveLength(1);
    expect(convenios[0]!.placas).toEqual(["ABC123"]);
    expect(convenios[0]!.activo).toBe(false);
  });

  it("quitar una placa la deja sin descuento", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Quitar" });
    const ctx = comoAdminDe(p.id);
    const c = await declararConvenio(ctx, { nombre: "Empresa", activacion: "placa", beneficio: "porcentaje", valor: 15 });
    await agregarPlaca(ctx, c.id, "ABC123");

    await quitarPlaca(ctx, c.id, "abc-123");
    expect(await descuentoParaPlaca(ctx, "ABC123", AHORA)).toBeNull();
  });
});

describe("la resolución es determinista", () => {
  it("una placa no puede estar en dos convenios del mismo establecimiento", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Determinista" });
    const ctx = comoAdminDe(p.id);
    const uno = await declararConvenio(ctx, { nombre: "Uno", activacion: "placa", beneficio: "porcentaje", valor: 10 });
    const dos = await declararConvenio(ctx, { nombre: "Dos", activacion: "placa", beneficio: "porcentaje", valor: 50 });

    await agregarPlaca(ctx, uno.id, "ABC123");

    // Sin esto, cuál gana dependería del orden de registro.
    await expect(agregarPlaca(ctx, dos.id, "ABC123")).rejects.toThrow(ConvenioInvalido);
  });

  it("la misma placa puede tener convenio en un local y ninguno en otro", async () => {
    const a = await crearParqueadero(ADMIN, { nombre: "Parqueadero Uno CV" });
    const b = await crearParqueadero(ADMIN, { nombre: "Parqueadero Dos CV" });

    const c = await declararConvenio(comoAdminDe(a.id), { nombre: "Solo en A", activacion: "placa", beneficio: "porcentaje", valor: 25 });
    await agregarPlaca(comoAdminDe(a.id), c.id, "ABC123");

    expect(await descuentoParaPlaca(comoAdminDe(a.id), "ABC123", AHORA)).not.toBeNull();
    expect(await descuentoParaPlaca(comoAdminDe(b.id), "ABC123", AHORA)).toBeNull();
  });
});

describe("validación", () => {
  it("rechaza un descuento fuera de 0 a 100 y un nombre vacío", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Validacion" });
    const ctx = comoAdminDe(p.id);

    await expect(declararConvenio(ctx, { nombre: "X", activacion: "placa", beneficio: "porcentaje", valor: 101 })).rejects.toThrow(
      ConvenioInvalido,
    );
    await expect(declararConvenio(ctx, { nombre: "X", activacion: "placa", beneficio: "porcentaje", valor: -1 })).rejects.toThrow(
      ConvenioInvalido,
    );
    await expect(declararConvenio(ctx, { nombre: "  ", activacion: "placa", beneficio: "porcentaje", valor: 10 })).rejects.toThrow(
      ConvenioInvalido,
    );
  });
});

describe("el establecimiento suspendido", () => {
  it("rechaza la escritura y permite la lectura (SC-005)", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero CV Suspenso" });
    const ctx = comoAdminDe(p.id);
    const c = await declararConvenio(ctx, { nombre: "Previo", activacion: "placa", beneficio: "porcentaje", valor: 10 });
    await agregarPlaca(ctx, c.id, "ABC123");

    await cambiarEstadoParqueadero(ADMIN, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "prueba de modo restringido",
    });

    const suspendido = comoAdminDe(p.id, "suspendido");
    await expect(
      declararConvenio(suspendido, { nombre: "Nuevo", activacion: "placa", beneficio: "porcentaje", valor: 5 }),
    ).rejects.toThrow(EstablecimientoRestringido);

    expect(await descuentoParaPlaca(suspendido, "ABC123", AHORA)).not.toBeNull();
  });
});
