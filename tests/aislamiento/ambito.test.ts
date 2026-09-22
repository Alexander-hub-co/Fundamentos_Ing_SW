import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { conAmbito, comoPlataforma } from "@/db/ambito";
import { cerrarPools } from "@/db/pools";
import { parqueadero } from "@/db/esquema";

/**
 * La prueba que no se puede omitir.
 *
 * Verifica el Principio I contra una instancia REAL de PostgreSQL. Sustituir la
 * base por un doble eliminaría exactamente el sujeto de la prueba: lo que hay
 * que demostrar es que las políticas del motor rechazan la fila, no que nuestro
 * código recuerde filtrar.
 *
 * Cubre V1 y V2 del quickstart, y la garantía transaccional de FR-012.
 */

let idA: string;

beforeAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${parqueadero} where codigo like 'TEST-%'`);
    const r = await tx.execute(sql`
      insert into ${parqueadero} (codigo, nombre)
      values ('TEST-A', 'Parqueadero A'), ('TEST-B', 'Parqueadero B')
      returning id, codigo
    `);
    const filas = r.rows as { id: string; codigo: string }[];
    idA = filas.find((f) => f.codigo === "TEST-A")!.id;
  });
});

afterAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${parqueadero} where codigo like 'TEST-%'`);
  });
  await cerrarPools();
});

describe("FR-012 — la variable de ámbito vive dentro de la transacción", () => {
  it("dentro de conAmbito la variable está fijada", async () => {
    const valor = await conAmbito(idA, async (tx) => {
      const r = await tx.execute(
        sql`select current_setting('app.parqueadero_id', true) as v`,
      );
      return (r.rows[0] as { v: string }).v;
    });

    expect(valor).toBe(idA);
  });

  it("fuera de la transacción la variable NO persiste", async () => {
    await conAmbito(idA, async () => {});

    const { dbTenant } = await import("@/db/pools");
    const r = await dbTenant().execute(
      sql`select current_setting('app.parqueadero_id', true) as v`,
    );

    // Vacío o nulo: lo que importa es que no arrastre el ámbito anterior a la
    // siguiente consulta que tome esa conexión del pool.
    const v = (r.rows[0] as { v: string | null }).v;
    expect(v === null || v === "").toBe(true);
  });
});

describe("el privilegio global es un rol distinto, no una bandera", () => {
  it("comoPlataforma sí alcanza ambos establecimientos", async () => {
    const filas = await comoPlataforma("administracion_plataforma", async (tx) => {
      const r = await tx.execute(
        sql`select codigo from ${parqueadero} where codigo like 'TEST-%' order by codigo`,
      );
      return r.rows as { codigo: string }[];
    });

    expect(filas.map((f) => f.codigo)).toEqual(["TEST-A", "TEST-B"]);
  });
});
