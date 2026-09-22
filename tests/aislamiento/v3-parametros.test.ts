import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { editarMiParqueadero } from "@/dominio/parqueaderos/editar";
import { obtenerMiParqueadero } from "@/dominio/parqueaderos/listar";
import type { Contexto } from "@/lib/sesion";

/**
 * V3 — El ámbito no viaja por parámetro (FR-009).
 *
 * El ataque que esta prueba simula es el más barato de todos: descubrir el
 * identificador del establecimiento ajeno e intentar colarlo por donde se
 * pueda. La defensa no es validarlo, es que **no exista ningún parámetro donde
 * ponerlo**: las operaciones de establecimiento no reciben identificador.
 */

let idA: string;
let idB: string;

beforeAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    // Las tablas de auditoría se limpian primero: sus claves foráneas hacia
    // la cuenta son justamente lo que impide borrar historial en producción.
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);

    const r = await tx.execute(sql`
      insert into ${parqueadero} (codigo, nombre)
      values ('V3-A', 'Establecimiento A'), ('V3-B', 'Establecimiento B')
      returning id, codigo
    `);
    const filas = r.rows as { id: string; codigo: string }[];
    idA = filas.find((f) => f.codigo === "V3-A")!.id;
    idB = filas.find((f) => f.codigo === "V3-B")!.id;
  });
});

afterAll(async () => {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    // Las tablas de auditoría se limpian primero: sus claves foráneas hacia
    // la cuenta son justamente lo que impide borrar historial en producción.
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
  });
  await cerrarPools();
});

const contextoDeA = (): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-a",
  rol: "admin_parqueadero",
  parqueaderoId: idA,
  estado: "activo",
});

describe("las operaciones de establecimiento no aceptan identificador", () => {
  it("obtenerMiParqueadero devuelve A aunque exista B", async () => {
    const propio = await obtenerMiParqueadero(contextoDeA());
    expect(propio?.codigo).toBe("V3-A");
  });

  it("inyectar el identificador de B en los datos de edición no cambia el ámbito", async () => {
    // Se cuelan campos que un atacante probaría: el nombre del parámetro que
    // usa el dominio, el de la columna y el del identificador crudo.
    const editado = await editarMiParqueadero(contextoDeA(), {
      nombre: "Renombrado por A",
      parqueaderoId: idB,
      parqueadero_id: idB,
      id: idB,
    } as never);

    // El UPDATE lo acotó la política RLS, no una validación del código.
    expect(editado.codigo).toBe("V3-A");
    expect(editado.nombre).toBe("Renombrado por A");
  });

  it("B quedó intacto tras el intento", async () => {
    const b = await comoPlataforma("administracion_plataforma", async (tx) => {
      const r = await tx.execute(
        sql`select nombre from ${parqueadero} where id = ${idB}`,
      );
      return (r.rows[0] as { nombre: string }).nombre;
    });

    expect(b).toBe("Establecimiento B");
  });
});

describe("el ámbito de la sesión es el único que manda", () => {
  it("un contexto con el ámbito de B sólo alcanza B", async () => {
    const contextoDeB: Contexto = {
      tipo: "establecimiento",
      usuarioId: "u-b",
      rol: "admin_parqueadero",
      parqueaderoId: idB,
      estado: "activo",
    };

    const propio = await obtenerMiParqueadero(contextoDeB);
    expect(propio?.codigo).toBe("V3-B");
  });
});
