import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { preferenciaUsuario, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import {
  guardarPreferencias,
  preferenciasDe,
  PreferenciaInvalida,
  PREFERENCIAS_POR_DEFECTO,
  type Preferencias,
} from "@/dominio/preferencias/gestionar";
import type { Contexto } from "@/lib/sesion";

/** Pantalla 8d — cada quien elige cómo ve Parquivo. */

const MARCELA: Contexto = {
  tipo: "establecimiento",
  usuarioId: "u-marcela",
  rol: "admin_parqueadero",
  parqueaderoId: "00000000-0000-0000-0000-000000000001",
  estado: "activo",
};

const JUAN: Contexto = { ...MARCELA, usuarioId: "u-juan", rol: "operario" };

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${preferenciaUsuario}`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values([
      { id: "u-marcela", name: "Marcela", email: "marcela@ejemplo.co" },
      { id: "u-juan", name: "Juan", email: "juan@ejemplo.co" },
    ]);
  });
}

const contarFilas = async () => {
  const filas = await comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(preferenciaUsuario),
  );
  return filas.length;
};

const OSCURAS: Preferencias = {
  tema: "claro",
  acento: "marino",
  densidad: "comoda",
  tamanoPlaca: 80,
  confirmarCobro: true,
  imprimirAuto: true,
  anchoRollo: 80,
};

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("preferencias de la cuenta", () => {
  it("quien nunca eligió nada recibe el punto de partida", async () => {
    expect(await preferenciasDe(MARCELA)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(await contarFilas()).toBe(0);
  });

  it("lo elegido se guarda y se recupera", async () => {
    await guardarPreferencias(MARCELA, OSCURAS);
    expect(await preferenciasDe(MARCELA)).toEqual(OSCURAS);
  });

  it("son de la persona, no del establecimiento", async () => {
    // Es la promesa que hace la propia pantalla: "un operario puede trabajar en
    // oscuro aunque usted use el claro".
    await guardarPreferencias(MARCELA, OSCURAS);

    expect(await preferenciasDe(JUAN)).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(await preferenciasDe(MARCELA)).toEqual(OSCURAS);
  });

  it("guardar dos veces actualiza en vez de duplicar", async () => {
    await guardarPreferencias(MARCELA, OSCURAS);
    await guardarPreferencias(MARCELA, { ...OSCURAS, tema: "oscuro" });

    expect(await contarFilas()).toBe(1);
    expect((await preferenciasDe(MARCELA)).tema).toBe("oscuro");
  });

  it("volver a los valores de fábrica borra la fila y no la congela", async () => {
    await guardarPreferencias(MARCELA, OSCURAS);
    expect(await contarFilas()).toBe(1);

    await guardarPreferencias(MARCELA, PREFERENCIAS_POR_DEFECTO);

    // Sin fila, quien nunca eligió y quien restableció quedan iguales: los dos
    // siguen al punto de partida si mañana cambia.
    expect(await contarFilas()).toBe(0);
    expect(await preferenciasDe(MARCELA)).toEqual(PREFERENCIAS_POR_DEFECTO);
  });

  it("un tamaño de placa ilegible se rechaza", async () => {
    await expect(guardarPreferencias(MARCELA, { ...OSCURAS, tamanoPlaca: 8 })).rejects.toThrow(
      PreferenciaInvalida,
    );
    await expect(guardarPreferencias(MARCELA, { ...OSCURAS, tamanoPlaca: 400 })).rejects.toThrow(
      PreferenciaInvalida,
    );
    await expect(guardarPreferencias(MARCELA, { ...OSCURAS, tamanoPlaca: 64.5 })).rejects.toThrow(
      PreferenciaInvalida,
    );

    expect(await contarFilas()).toBe(0);
  });

  it("la base rechaza un tamaño ilegible aunque el dominio no lo viera", async () => {
    // La comprobación vive en los dos sitios a propósito: el mensaje útil lo da
    // el dominio, pero la garantía tiene que sobrevivir a cualquier código
    // futuro que escriba en la tabla sin pasar por él.
    await expect(
      comoPlataforma("administracion_plataforma", (tx) =>
        tx.insert(preferenciaUsuario).values({
          usuarioId: "u-juan",
          tema: "claro",
          acento: "verde",
          densidad: "densa",
          tamanoPlaca: 5,
        }),
      ),
    ).rejects.toThrow();
  });
});
