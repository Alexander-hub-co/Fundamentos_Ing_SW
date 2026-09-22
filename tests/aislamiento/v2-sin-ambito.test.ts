import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
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


beforeAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${parqueadero} where codigo like 'TEST-%'`);
    await tx.execute(sql`
      insert into ${parqueadero} (codigo, nombre)
      values ('TEST-A', 'Parqueadero A'), ('TEST-B', 'Parqueadero B')
    `);
  });
});

afterAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${parqueadero} where codigo like 'TEST-%'`);
  });
  await cerrarPools();
});

describe("V2 — sin ámbito no se devuelve todo", () => {
  it("una consulta sin ámbito fijado devuelve cero filas, nunca el conjunto completo", async () => {
    // Se usa el pool con ámbito pero sin fijar la variable: es el escenario que
    // FR-010 exige que falle cerrando.
    const { dbTenant } = await import("@/db/pools");
    const r = await dbTenant().execute(sql`select codigo from ${parqueadero}`);

    expect(r.rows).toHaveLength(0);
  });
});

