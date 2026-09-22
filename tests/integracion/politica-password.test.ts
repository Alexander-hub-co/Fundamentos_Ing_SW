import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { restablecerPassword } from "@/dominio/cuentas/restablecer";
import { PasswordDebil } from "@/dominio/autenticacion/cambio-obligatorio";
import { LARGO_MINIMO_PASSWORD } from "@/dominio/autenticacion/parametros";
import { iniciarSesion } from "@/dominio/autenticacion/iniciar-sesion";
import type { Contexto } from "@/lib/sesion";

/**
 * La política de contraseñas vale en las TRES puertas.
 *
 * El mínimo existía desde F1 pero sólo lo aplicaba la ruta por la que una
 * persona cambia su propia contraseña. Las dos rutas del administrador —crear
 * una cuenta y restablecer una contraseña— escribían sin mirar el largo, así
 * que una temporal de un solo carácter abría sesión perfectamente.
 *
 * Se descubrió porque una cuenta de prueba tenía una clave de cinco caracteres
 * y entraba.
 */

const ADMIN: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-politica",
  rol: "admin_general",
};

const BUENA = "ClaveLargaSegura2026";
const CORTA = "12345";

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-politica",
      name: "Admin",
      email: "politica@ejemplo.co",
    });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("el mínimo se exige al crear una cuenta", () => {
  it("rechaza una contraseña temporal corta", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Politica" });

    await expect(
      crearCuenta(ADMIN, {
        email: "corta@ejemplo.co",
        nombre: "Persona",
        passwordTemporal: CORTA,
        rol: "operario",
        parqueaderoId: p.id,
      }),
    ).rejects.toThrow(PasswordDebil);
  });

  it("acepta una que cumple el mínimo", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Ok" });

    const creada = await crearCuenta(ADMIN, {
      email: "larga@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: BUENA,
      rol: "operario",
      parqueaderoId: p.id,
    });

    expect(creada.usuarioId).toBeTruthy();
  });
});

describe("el mínimo se exige al restablecer", () => {
  it("rechaza una contraseña corta y no deja la cuenta con ella", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Reset" });
    const creada = await crearCuenta(ADMIN, {
      email: "reset@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: BUENA,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await expect(
      restablecerPassword(ADMIN, { usuarioId: creada.usuarioId, passwordTemporal: CORTA }),
    ).rejects.toThrow(PasswordDebil);

    // La contraseña anterior sigue siendo la buena: el rechazo no dejó la
    // cuenta a medio camino.
    const intento = await iniciarSesion({ email: "reset@ejemplo.co", password: BUENA });
    expect(intento.tipo).not.toBe("credenciales_invalidas");
  });

  it("una contraseña corta nunca queda utilizable para entrar", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Entrada" });
    const creada = await crearCuenta(ADMIN, {
      email: "entrada@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: BUENA,
      rol: "operario",
      parqueaderoId: p.id,
    });

    await restablecerPassword(ADMIN, {
      usuarioId: creada.usuarioId,
      passwordTemporal: CORTA,
    }).catch(() => {});

    const intento = await iniciarSesion({ email: "entrada@ejemplo.co", password: CORTA });
    expect(intento.tipo).toBe("credenciales_invalidas");
  });
});

describe("el límite está donde dice el parámetro", () => {
  it(`rechaza ${LARGO_MINIMO_PASSWORD - 1} caracteres y acepta ${LARGO_MINIMO_PASSWORD}`, async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Limite" });
    const justo = "a".repeat(LARGO_MINIMO_PASSWORD);
    const unoMenos = "a".repeat(LARGO_MINIMO_PASSWORD - 1);

    await expect(
      crearCuenta(ADMIN, {
        email: "limite1@ejemplo.co",
        nombre: "Persona",
        passwordTemporal: unoMenos,
        rol: "operario",
        parqueaderoId: p.id,
      }),
    ).rejects.toThrow(PasswordDebil);

    const ok = await crearCuenta(ADMIN, {
      email: "limite2@ejemplo.co",
      nombre: "Persona",
      passwordTemporal: justo,
      rol: "operario",
      parqueaderoId: p.id,
    });
    expect(ok.usuarioId).toBeTruthy();
  });
});
