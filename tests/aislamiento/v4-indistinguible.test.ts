import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { accesoDenegado, parqueadero } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { RecursoNoAlcanzable } from "@/lib/errores";
import {
  errorDeAlcance,
  registrarAccesoDenegado,
} from "@/dominio/auditoria/acceso-denegado";

/**
 * V4 — Un recurso ajeno y uno inexistente son indistinguibles (FR-011).
 *
 * Si difirieran, probando identificadores se podría averiguar cuáles existen:
 * la aplicación se volvería un oráculo que revela la estructura de los datos de
 * otros clientes sin mostrar ni un solo dato.
 */

let idA: string;
let idB: string;
const INEXISTENTE = "00000000-0000-0000-0000-000000000000";

beforeAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    const r = await tx.execute(sql`
      insert into ${parqueadero} (codigo, nombre)
      values ('V4-A', 'A'), ('V4-B', 'B')
      returning id, codigo
    `);
    const filas = r.rows as { id: string; codigo: string }[];
    idA = filas.find((f) => f.codigo === "V4-A")!.id;
    idB = filas.find((f) => f.codigo === "V4-B")!.id;
  });
});

afterAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from ${parqueadero}`);
  });
  await cerrarPools();
});

/** Busca un establecimiento por identificador desde el ámbito de A. */
async function buscarDesdeA(id: string) {
  return conAmbito(idA, async (tx) => {
    const r = await tx.execute(
      sql`select codigo from ${parqueadero} where id = ${id}`,
    );
    return (r.rows[0] as { codigo: string } | undefined) ?? null;
  });
}

describe("la base entrega el mismo resultado en ambos casos", () => {
  it("el recurso ajeno se ve como inexistente", async () => {
    expect(await buscarDesdeA(idB)).toBeNull();
  });

  it("el recurso inexistente también", async () => {
    expect(await buscarDesdeA(INEXISTENTE)).toBeNull();
  });

  it("y el propio sí aparece, para descartar que todo devuelva null", async () => {
    const propio = await buscarDesdeA(idA);
    expect(propio?.codigo).toBe("V4-A");
  });
});

describe("el error expuesto es idéntico", () => {
  it("mismo código, mismo nombre y mismo mensaje", async () => {
    // Se ejercita el camino real de denegación, el mismo que usan las páginas
    // y el dominio: si algún día ese camino distinguiera ambos casos, esta
    // prueba lo vería.
    const ajeno: RecursoNoAlcanzable = await errorDeAlcance(null, `parqueadero:${idB}`);
    const inexistente: RecursoNoAlcanzable = await errorDeAlcance(
      null,
      `parqueadero:${INEXISTENTE}`,
    );

    expect(ajeno.message).toBe(inexistente.message);
    expect(ajeno.estado).toBe(inexistente.estado);
    expect(ajeno.name).toBe(inexistente.name);
    expect(ajeno.aRespuesta()).toEqual(inexistente.aRespuesta());
  });

  it("la respuesta no filtra qué recurso se pidió", () => {
    const error = new RecursoNoAlcanzable(`parqueadero:${idB}`);
    expect(JSON.stringify(error.aRespuesta())).not.toContain(idB);
  });
});

describe("el intento queda registrado (FR-005)", () => {
  it("anota cuenta, recurso, ámbito y momento", async () => {
    await registrarAccesoDenegado({
      usuarioId: null,
      recurso: `parqueadero:${idB}`,
      parqueaderoAmbito: idA,
    });

    // Se filtra por ámbito en vez de contar la tabla entera: las pruebas de
    // más arriba, que comparan los dos errores, pasan por el camino real y ese
    // camino ahora también deja asiento. Contar todo mediría eso además de lo
    // que aquí interesa.
    const filas = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado).where(eq(accesoDenegado.parqueaderoAmbito, idA)),
    );

    expect(filas).toHaveLength(1);
    expect(filas[0]!.recurso).toBe(`parqueadero:${idB}`);
    expect(filas[0]!.parqueaderoAmbito).toBe(idA);
    expect(filas[0]!.ocurridoEn).toBeInstanceOf(Date);
  });
});
