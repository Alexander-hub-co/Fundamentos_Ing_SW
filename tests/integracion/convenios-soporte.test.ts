import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usoPrivilegio, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { crearCuenta } from "@/dominio/cuentas/crear";
import { comoEstablecimiento } from "@/dominio/configuracion/como-plataforma";
import {
  conveniosDelEstablecimiento,
  declararConvenio,
} from "@/dominio/convenios/gestionar";
import type { Contexto } from "@/lib/sesion";

/**
 * FR-016a y FR-016b — el administrador general arreglando un convenio por
 * teléfono.
 *
 * Existe porque hay clientes que no se manejan bien con el sistema y llaman a
 * que les arreglen algo. La puerta ESTRECHA el alcance del administrador
 * general al establecimiento indicado, en lugar de elevar privilegios, y deja
 * el rastro por dos vías: el asiento de uso de privilegio y el propio dato, que
 * queda con su identificador.
 */

const ADMIN_GENERAL: Contexto = { tipo: "plataforma", usuarioId: "u-plataforma", rol: "admin_general" };

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from ${usoPrivilegio}`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx
      .insert(usuario)
      .values({ id: "u-plataforma", name: "Admin General", email: "plataforma@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

/** Un establecimiento con su propia administradora, que es quien mira después. */
async function establecimientoConDuena() {
  const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero del Cliente" });
  const { usuarioId } = await crearCuenta(ADMIN_GENERAL, {
    email: "duena@ejemplo.co",
    nombre: "Dueña del Local",
    passwordTemporal: "ClaveTemporal2026",
    rol: "admin_parqueadero",
    parqueaderoId: p.id,
  });

  const suyo: Contexto = {
    tipo: "establecimiento",
    usuarioId,
    rol: "admin_parqueadero",
    parqueaderoId: p.id,
    estado: "activo",
  };
  return { parqueaderoId: p.id, suyo, usuarioId };
}

describe("soporte declara un convenio para un establecimiento ajeno", () => {
  it("el convenio queda declarado en el establecimiento correcto", async () => {
    const { parqueaderoId, suyo } = await establecimientoConDuena();

    const acotado = await comoEstablecimiento(ADMIN_GENERAL, parqueaderoId, "declarar_convenio");
    await declararConvenio(acotado, {
      nombre: "Fruver que pidió por teléfono",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 60,
    });

    const vistos = await conveniosDelEstablecimiento(suyo);
    expect(vistos.map((c) => c.nombre)).toEqual(["Fruver que pidió por teléfono"]);
  });

  it("queda con el administrador general como autor, no con el del local", async () => {
    const { parqueaderoId, usuarioId } = await establecimientoConDuena();

    const acotado = await comoEstablecimiento(ADMIN_GENERAL, parqueaderoId, "declarar_convenio");
    const c = await declararConvenio(acotado, {
      nombre: "Soporte",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 30,
    });

    expect(c.creadoPor).toBe("u-plataforma");
    expect(c.creadoPor).not.toBe(usuarioId);
  });

  it("la dueña del local puede distinguirlo de los suyos sin preguntarle a nadie", async () => {
    // FR-016b. Sin esto vería aparecer cambios que no hizo y sin forma de saber
    // de quién son, que es peor que no poder recibir soporte.
    const { parqueaderoId, suyo } = await establecimientoConDuena();

    await declararConvenio(suyo, {
      nombre: "El que declaré yo",
      activacion: "placa",
      beneficio: "porcentaje",
      valor: 20,
    });

    const acotado = await comoEstablecimiento(ADMIN_GENERAL, parqueaderoId, "declarar_convenio");
    await declararConvenio(acotado, {
      nombre: "El que me declararon",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 60,
    });

    const vistos = await conveniosDelEstablecimiento(suyo);
    const porNombre = Object.fromEntries(vistos.map((c) => [c.nombre, c.declaradoPorSoporte]));

    expect(porNombre["El que declaré yo"]).toBe(false);
    expect(porNombre["El que me declararon"]).toBe(true);
  });

  it("deja asiento de uso de privilegio, con el autor y la operación", async () => {
    const { parqueaderoId } = await establecimientoConDuena();

    await comoEstablecimiento(ADMIN_GENERAL, parqueaderoId, "declarar_convenio");

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(usoPrivilegio).where(eq(usoPrivilegio.usuarioId, "u-plataforma")),
    );

    expect(asientos.some((a) => a.operacion === "soporte.declarar_convenio")).toBe(true);
  });
});

describe("la puerta estrecha, no eleva", () => {
  it("un administrador de establecimiento no puede abrirla", async () => {
    const { parqueaderoId, suyo } = await establecimientoConDuena();

    // Si esto pasara, cualquier administrador de local podría operar sobre
    // otro: sería la escalada de privilegios que la puerta existe para evitar.
    await expect(
      comoEstablecimiento(suyo, parqueaderoId, "declarar_convenio"),
    ).rejects.toThrow();
  });

  it("el contexto derivado queda acotado a ese establecimiento y a nada más", async () => {
    const { parqueaderoId } = await establecimientoConDuena();
    const otro = await crearParqueadero(ADMIN_GENERAL, { nombre: "Otro Establecimiento" });

    const acotado = await comoEstablecimiento(ADMIN_GENERAL, parqueaderoId, "declarar_convenio");
    await declararConvenio(acotado, {
      nombre: "Sólo del primero",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 15,
    });

    const enElOtro = await comoEstablecimiento(ADMIN_GENERAL, otro.id, "revisar");
    expect(await conveniosDelEstablecimiento(enElOtro)).toHaveLength(0);
  });
});
