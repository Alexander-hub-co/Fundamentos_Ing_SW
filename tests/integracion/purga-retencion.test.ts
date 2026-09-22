import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { accesoDenegado, intentoLogin, mantenimiento, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { purgarSiCorresponde } from "@/dominio/auditoria/retencion";

/**
 * FR-047 — la auditoría vencida se elimina automáticamente a los 12 meses.
 *
 * La función que borra ya existía; lo que faltaba era que algo la invocara. Lo
 * que se verifica acá es el disparador: que corra cuando toca, que no corra
 * cuando no toca, y que respete el corte.
 */

const AHORA = new Date("2026-08-16T12:00:00Z");
const HACE_TRECE_MESES = new Date("2025-07-16T12:00:00Z");
const HACE_UN_MES = new Date("2026-07-16T12:00:00Z");

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from ${intentoLogin}`);
    await tx.execute(sql`delete from ${mantenimiento}`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
  });
}

async function sembrar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.insert(intentoLogin).values([
      { emailIntentado: "viejo@ejemplo.co", exito: false, ocurridoEn: HACE_TRECE_MESES },
      { emailIntentado: "reciente@ejemplo.co", exito: true, ocurridoEn: HACE_UN_MES },
    ]);
    await tx.insert(accesoDenegado).values([
      { recurso: "parqueadero:viejo", ocurridoEn: HACE_TRECE_MESES },
      { recurso: "parqueadero:reciente", ocurridoEn: HACE_UN_MES },
    ]);
  });
}

async function cuantos() {
  return comoPlataforma("administracion_plataforma", async (tx) => {
    const i = await tx.select().from(intentoLogin);
    const a = await tx.select().from(accesoDenegado);
    return { intentos: i.length, accesos: a.length };
  });
}

beforeEach(async () => {
  await limpiar();
  await sembrar();
});
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("purga automática de la auditoría", () => {
  it("borra lo vencido y conserva lo que está dentro de la retención", async () => {
    const resultado = await purgarSiCorresponde(AHORA);

    expect(resultado).not.toBeNull();
    expect(resultado!.intentosEliminados).toBe(1);
    expect(resultado!.accesosDenegadosEliminados).toBe(1);
    expect(await cuantos()).toEqual({ intentos: 1, accesos: 1 });
  });

  it("no vuelve a correr antes de que pase el intervalo", async () => {
    await purgarSiCorresponde(AHORA);

    // Una hora después no debe hacer nada: la comprobación ocurre en cada
    // entrada al panel, y purgar en cada una sería trabajo inútil.
    const segunda = await purgarSiCorresponde(new Date(AHORA.getTime() + 3_600_000));
    expect(segunda).toBeNull();
  });

  it("vuelve a correr pasado el intervalo", async () => {
    await purgarSiCorresponde(AHORA);
    await sembrar();

    const dosDiasDespues = new Date(AHORA.getTime() + 2 * 24 * 3_600_000);
    const tercera = await purgarSiCorresponde(dosDiasDespues);

    expect(tercera).not.toBeNull();
    expect(tercera!.intentosEliminados).toBeGreaterThan(0);
  });

  it("deja la marca en la base, para que sobreviva a un reinicio", async () => {
    await purgarSiCorresponde(AHORA);

    const marcas = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(mantenimiento),
    );

    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.clave).toBe("purga_auditoria");
  });
});
