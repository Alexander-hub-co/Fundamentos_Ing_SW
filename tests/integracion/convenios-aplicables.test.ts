import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { agregarPlaca, declararConvenio, vencerConvenio } from "@/dominio/convenios/gestionar";
import { conveniosAplicables } from "@/dominio/convenios/consultar";
import { fijarRedondeo, politicaDeCobro } from "@/dominio/cobro/politica";
import type { Contexto } from "@/lib/sesion";

/**
 * Historia 2 — lo que la taquilla va a consultar, y la política de redondeo.
 *
 * Son las dos funciones nuevas que tocan la base. El cálculo en sí es puro y se
 * prueba aparte, sin base de datos.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-apl", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-apl",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-apl", name: "Admin", email: "apl@ejemplo.co" });
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

const AHORA = new Date(2026, 7, 19, 15, 0);

describe("qué convenios entran en juego para una placa", () => {
  it("los de sello salen siempre; los de placa, sólo si cubren esa placa", async () => {
    const ctx = await establecimiento();
    await declararConvenio(ctx, {
      nombre: "Fruver", activacion: "sello", beneficio: "minutos_gratis", valor: 60,
    });
    const frecuente = await declararConvenio(ctx, {
      nombre: "Frecuente", activacion: "placa", beneficio: "porcentaje", valor: 50,
    });
    await agregarPlaca(ctx, frecuente.id, "ABC123");

    const cubierta = await conveniosAplicables(ctx, "abc 123", AHORA);
    expect(cubierta.porSello.map((c) => c.nombre)).toEqual(["Fruver"]);
    expect(cubierta.automaticos.map((c) => c.nombre)).toEqual(["Frecuente"]);

    const ajena = await conveniosAplicables(ctx, "XYZ999", AHORA);
    expect(ajena.porSello.map((c) => c.nombre)).toEqual(["Fruver"]);
    expect(ajena.automaticos).toEqual([]);
  });

  it("sin placa se devuelven sólo los de sello", async () => {
    const ctx = await establecimiento();
    await declararConvenio(ctx, {
      nombre: "Fruver", activacion: "sello", beneficio: "minutos_gratis", valor: 60,
    });

    const r = await conveniosAplicables(ctx, null, AHORA);
    expect(r.porSello).toHaveLength(1);
    expect(r.automaticos).toEqual([]);
  });

  it("un convenio vencido no entra en juego", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Vencido", activacion: "sello", beneficio: "minutos_gratis", valor: 60,
    });

    expect((await conveniosAplicables(ctx, null, AHORA)).porSello).toHaveLength(1);
    await vencerConvenio(ctx, c.id);
    expect((await conveniosAplicables(ctx, null, AHORA)).porSello).toHaveLength(0);
  });

  it("dice contra qué día se cuentan los límites, en hora de Colombia", async () => {
    const ctx = await establecimiento();
    // Las 02:00 UTC del 20 son las 21:00 del 19 en Bogotá.
    const r = await conveniosAplicables(ctx, null, new Date("2026-08-20T02:00:00Z"));
    expect(r.dia).toBe("2026-08-19");
  });

  it("no lleva la cuenta de aplicaciones previas: eso lo aporta quien llama", async () => {
    const ctx = await establecimiento();
    await declararConvenio(ctx, {
      nombre: "Fruver", activacion: "sello", beneficio: "minutos_gratis", valor: 60, limiteDiario: 1,
    });

    const [c] = (await conveniosAplicables(ctx, null, AHORA)).porSello;
    expect(c).toBeDefined();
    expect(c).not.toHaveProperty("aplicacionesPreviasHoy");
    expect(c!.limiteDiario).toBe(1);
  });
});

describe("la regla de redondeo del establecimiento", () => {
  it("sin declarar, vale el valor inicial", async () => {
    const ctx = await establecimiento();
    expect(await politicaDeCobro(ctx)).toBe("peso");
  });

  it("se declara y se relee", async () => {
    const ctx = await establecimiento();
    await fijarRedondeo(ctx, "centena");
    expect(await politicaDeCobro(ctx)).toBe("centena");
  });

  it("cambiarla dos veces actualiza en vez de fallar", async () => {
    // La columna es única por establecimiento: sin el upsert, el segundo cambio
    // reventaría contra la restricción.
    const ctx = await establecimiento();
    await fijarRedondeo(ctx, "centena");
    await fijarRedondeo(ctx, "cincuentena");
    expect(await politicaDeCobro(ctx)).toBe("cincuentena");
  });
});
