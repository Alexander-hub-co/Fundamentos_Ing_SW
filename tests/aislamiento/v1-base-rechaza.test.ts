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
let idB: string;

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
    idB = filas.find((f) => f.codigo === "TEST-B")!.id;
  });
});

afterAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${parqueadero} where codigo like 'TEST-%'`);
  });
  await cerrarPools();
});

describe("V1 — la base rechaza, no la aplicación", () => {
  it("una consulta SIN filtro dentro del ámbito de A devuelve sólo A", async () => {
    // SQL deliberadamente crudo y sin cláusula WHERE: simula al programador
    // que olvidó filtrar. La política debe taparlo.
    const filas = await conAmbito(idA, async (tx) => {
      const r = await tx.execute(sql`select codigo from ${parqueadero}`);
      return r.rows as { codigo: string }[];
    });

    expect(filas.map((f) => f.codigo)).toEqual(["TEST-A"]);
  });

  it("desde el ámbito de A, pedir B por identificador directo no devuelve nada", async () => {
    const filas = await conAmbito(idA, async (tx) => {
      const r = await tx.execute(
        sql`select codigo from ${parqueadero} where id = ${idB}`,
      );
      return r.rows;
    });

    expect(filas).toHaveLength(0);
  });
});

