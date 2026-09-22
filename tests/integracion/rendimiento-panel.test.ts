import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, cambioEstado, parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { listarParqueaderos } from "@/dominio/parqueaderos/listar";
import { obtenerResumenPlataforma } from "@/dominio/plataforma/resumen";
import type { Contexto } from "@/lib/sesion";

/**
 * V11 — El panel y el listado con volumen realista (SC-007).
 *
 * Se puebla la base con 1.000 establecimientos, que es la escala declarada en
 * la especificación, y se mide. El límite son 2 segundos.
 *
 * Una prueba de tiempo puede dar falsos negativos en una máquina cargada, así
 * que el margen es deliberadamente generoso: lo que se busca detectar es una
 * consulta que crece de forma lineal por establecimiento —el clásico problema
 * de una consulta por fila— no una diferencia de milisegundos.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-general",
  rol: "admin_general",
};

const CANTIDAD = 1_000;
const LIMITE_MS = 2_000;

beforeAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${cambioEstado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-general",
      name: "Admin General",
      email: "general@ejemplo.co",
    });

    // Inserción masiva en una sola sentencia: poblar con mil llamadas al
    // dominio tardaría más que la prueba misma.
    await tx.execute(sql`
      insert into ${parqueadero} (codigo, nombre, ciudad, estado)
      select
        'PQV-' || lpad(n::text, 6, '0'),
        'Parqueadero ' || n,
        'Ciudad ' || (n % 20),
        (array['activo','pendiente','suspendido','dado_de_baja'])[1 + (n % 4)]::estado_parqueadero
      from generate_series(1, ${CANTIDAD}) as n
    `);
  });
}, 60_000);

afterAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${cambioEstado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${usuario}`);
  });
  await cerrarPools();
});

describe(`con ${CANTIDAD} establecimientos`, () => {
  it("la base quedó poblada", async () => {
    const r = await obtenerResumenPlataforma(ADMIN_GENERAL);
    expect(r.totalEstablecimientos).toBe(CANTIDAD);
  });

  it(`el panel responde en menos de ${LIMITE_MS} ms`, async () => {
    const inicio = performance.now();
    const resumen = await obtenerResumenPlataforma(ADMIN_GENERAL);
    const transcurrido = performance.now() - inicio;

    expect(resumen.totalEstablecimientos).toBe(CANTIDAD);
    expect(
      transcurrido,
      `El panel tardó ${Math.round(transcurrido)} ms`,
    ).toBeLessThan(LIMITE_MS);
  });

  it(`el listado completo responde en menos de ${LIMITE_MS} ms`, async () => {
    const inicio = performance.now();
    const filas = await listarParqueaderos(ADMIN_GENERAL);
    const transcurrido = performance.now() - inicio;

    expect(filas).toHaveLength(CANTIDAD);
    expect(
      transcurrido,
      `El listado tardó ${Math.round(transcurrido)} ms`,
    ).toBeLessThan(LIMITE_MS);
  });

  it("el listado filtrado por estado también", async () => {
    const inicio = performance.now();
    const activos = await listarParqueaderos(ADMIN_GENERAL, { estado: "activo" });
    const transcurrido = performance.now() - inicio;

    expect(activos.length).toBeGreaterThan(0);
    expect(activos.every((p) => p.estado === "activo")).toBe(true);
    expect(transcurrido).toBeLessThan(LIMITE_MS);
  });

  it("la suma de los cuatro contadores sigue cuadrando a esta escala", async () => {
    const r = await obtenerResumenPlataforma(ADMIN_GENERAL);
    const suma = Object.values(r.establecimientos).reduce((a, b) => a + b, 0);
    expect(suma).toBe(CANTIDAD);
  });
});
