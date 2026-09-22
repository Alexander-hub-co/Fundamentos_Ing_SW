import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { desc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import {
  asignacion,
  cambioEstado,
  cuenta as credencial,
  intentoLogin,
  parqueadero,
  sesion,
  usuario,
} from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { iniciarSesion } from "@/dominio/autenticacion/iniciar-sesion";
import { INTENTOS_SIN_PENALIZACION } from "@/dominio/autenticacion/parametros";
import type { Contexto } from "@/lib/sesion";

/**
 * FR-006 y FR-008 sobre el camino completo, no sobre la función pura.
 *
 * `demora.test.ts` ya comprueba la aritmética de la espera. Lo que faltaba era
 * esto: que iniciar sesión de verdad DEJE RASTRO y que ese rastro sea el que
 * enciende la demora. Sin esta prueba, el registro podía dejar de escribirse
 * —o no llamarse nunca, que fue lo que pasó— sin que nada se pusiera rojo.
 */

const ADMIN_GENERAL: Contexto = { tipo: "plataforma", usuarioId: "u-general", rol: "admin_general" };
const CLAVE = "ClaveDePrueba2026";
const CORREO = "operario@ejemplo.co";
const ORIGEN = "203.0.113.77";

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    await tx.execute(sql`delete from ${credencial}`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${cambioEstado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${intentoLogin}`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx
      .insert(usuario)
      .values({ id: "u-general", name: "Admin General", email: "general@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

async function cuentaNueva() {
  const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Central" });
  await crearCuenta(ADMIN_GENERAL, {
    email: CORREO,
    nombre: "Persona Operaria",
    passwordTemporal: CLAVE,
    rol: "operario",
    parqueaderoId: p.id,
  });
}

const intentos = () =>
  comoPlataforma("autenticacion", (tx) =>
    tx.select().from(intentoLogin).orderBy(desc(intentoLogin.ocurridoEn)),
  );

describe("todo intento de ingreso deja rastro", () => {
  it("el fallido se anota, con el correo y el origen", async () => {
    await cuentaNueva();
    await iniciarSesion({ email: CORREO, password: "no-es-esta", origen: ORIGEN });

    const filas = await intentos();
    expect(filas).toHaveLength(1);
    expect(filas[0]?.exito).toBe(false);
    expect(filas[0]?.emailIntentado).toBe(CORREO);
    expect(filas[0]?.origen).toBe(ORIGEN);
  });

  it("el correcto también se anota", async () => {
    await cuentaNueva();
    const r = await iniciarSesion({ email: CORREO, password: CLAVE, origen: ORIGEN });

    // Nace obligada a cambiar la contraseña, y eso cuenta como entrar bien.
    expect(r.tipo).toBe("debe_cambiar_password");
    const filas = await intentos();
    expect(filas).toHaveLength(1);
    expect(filas[0]?.exito).toBe(true);
  });

  it("se anota el intento contra un correo que no existe", async () => {
    // Se anota por CORREO INTENTADO y no por cuenta, para que un atacante no
    // note la diferencia entre un correo registrado y uno inventado.
    await iniciarSesion({ email: "fantasma@ejemplo.co", password: "loquesea" });

    const filas = await intentos();
    expect(filas).toHaveLength(1);
    expect(filas[0]?.usuarioId).toBeNull();
    expect(filas[0]?.emailIntentado).toBe("fantasma@ejemplo.co");
  });
});

describe("el rastro es lo que enciende la demora", () => {
  it("pasado el umbral de fallos, el siguiente intento se frena", async () => {
    await cuentaNueva();

    for (let i = 0; i <= INTENTOS_SIN_PENALIZACION; i++) {
      await iniciarSesion({ email: CORREO, password: "no-es-esta" });
    }

    // Se frena incluso con la contraseña BUENA: la demora se evalúa antes de
    // tocar las credenciales, así el tiempo de respuesta no delata si el correo
    // existe.
    const r = await iniciarSesion({ email: CORREO, password: CLAVE });
    expect(r.tipo).toBe("demora_activa");
  });

  it("no hay demora mientras no se pase del umbral", async () => {
    await cuentaNueva();

    for (let i = 0; i < INTENTOS_SIN_PENALIZACION; i++) {
      await iniciarSesion({ email: CORREO, password: "no-es-esta" });
    }

    const r = await iniciarSesion({ email: CORREO, password: CLAVE });
    expect(r.tipo).toBe("debe_cambiar_password");
  });
});
