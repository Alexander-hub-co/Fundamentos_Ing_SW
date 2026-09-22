import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import {
  ConvenioInvalido,
  declararConvenio,
} from "@/dominio/convenios/gestionar";
import type { Contexto } from "@/lib/sesion";

/**
 * Historia 1 — el sistema se niega a guardar un convenio incoherente.
 *
 * Cada rechazo llega como un mensaje que la persona puede corregir, no como una
 * violación de restricción cruda. La restricción del motor sigue ahí y es la
 * red de seguridad; lo que se prueba acá es que nadie llegue a verla.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-val", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-val",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-val", name: "Admin", email: "val@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

async function establecimiento() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero del Centro" });
  return comoAdminDe(p.id);
}

describe("el beneficio exige lo suyo y prohíbe lo ajeno", () => {
  it("un porcentaje sin valor no se guarda", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, { nombre: "X", activacion: "placa", beneficio: "porcentaje" }),
    ).rejects.toThrow(ConvenioInvalido);
  });

  it("un porcentaje mayor que cien no se guarda", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, { nombre: "X", activacion: "placa", beneficio: "porcentaje", valor: 101 }),
    ).rejects.toThrow(/no puede pasar de 100/);
  });

  it("un sin cobro CON valor no se guarda", async () => {
    // Es la equivocación fácil: rellenar el cero "por si acaso". Cobrar cero y
    // no cobrar son dos declaraciones distintas y el sistema no las confunde.
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, { nombre: "X", activacion: "placa", beneficio: "sin_cobro", valor: 0 }),
    ).rejects.toThrow(/no lleva ningún valor/);
  });

  it("unos minutos gratis de cero no se guardan", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, { nombre: "X", activacion: "sello", beneficio: "minutos_gratis", valor: 0 }),
    ).rejects.toThrow(ConvenioInvalido);
  });

  it("una tarifa fija de cero SÍ se guarda", async () => {
    // Cobrar cero pesos es una declaración legítima y distinta de "sin cobro":
    // deja constancia de que se calculó y dio cero.
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Gratis por hoy", activacion: "sello", beneficio: "tarifa_fija", valor: 0,
    });
    expect(c.valor).toBe(0);
  });

  it("un convenio sin nombre no se guarda", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, { nombre: "   ", activacion: "sello", beneficio: "minutos_gratis", valor: 30 }),
    ).rejects.toThrow(/necesita un nombre/);
  });
});

describe("los límites tienen que tener sentido", () => {
  it("un límite diario de cero no se guarda, y el mensaje dice qué hacer", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, {
        nombre: "X", activacion: "sello", beneficio: "minutos_gratis", valor: 30, limiteDiario: 0,
      }),
    ).rejects.toThrow(/desactive el convenio/);
  });

  it("un límite diario negativo no se guarda", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, {
        nombre: "X", activacion: "sello", beneficio: "minutos_gratis", valor: 30, limiteDiario: -1,
      }),
    ).rejects.toThrow(ConvenioInvalido);
  });

  it("un tope de cero no se guarda: un tope que no deja descontar nada no es un tope", async () => {
    const ctx = await establecimiento();
    await expect(
      declararConvenio(ctx, {
        nombre: "X", activacion: "placa", beneficio: "porcentaje", valor: 50, topePesos: 0,
      }),
    ).rejects.toThrow(/mayor que cero/);
  });
});

describe("ningún rechazo llega como error del motor", () => {
  it("todos son ConvenioInvalido, con mensaje legible", async () => {
    const ctx = await establecimiento();
    const intentos = [
      { nombre: "A", activacion: "placa" as const, beneficio: "porcentaje" as const },
      { nombre: "B", activacion: "sello" as const, beneficio: "minutos_gratis" as const, valor: 0 },
      { nombre: "C", activacion: "placa" as const, beneficio: "sin_cobro" as const, valor: 5 },
    ];

    for (const datos of intentos) {
      const error = await declararConvenio(ctx, datos).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConvenioInvalido);
      // Un mensaje del motor traería "violates check constraint"; éste no.
      expect((error as Error).message).not.toMatch(/constraint|violates|null value/i);
    }
  });
});
