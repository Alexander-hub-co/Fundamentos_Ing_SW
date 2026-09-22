import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import {
  accesoDenegado,
  convenio,
  convenioPlaca,
  parqueadero,
  politicaCobro,
  usuario,
} from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import {
  agregarPlaca,
  conveniosDelEstablecimiento,
  descuentoParaPlaca,
  declararConvenio,
  vencerConvenio,
} from "@/dominio/convenios/gestionar";
import { RecursoNoAlcanzable } from "@/lib/errores";
import type { Contexto } from "@/lib/sesion";

/** Prueba negativa del Principio I sobre convenios y sus placas. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-aisl-cv", rol: "admin_general" };
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-cv",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

let idA: string;
let idB: string;
let convenioDeB: string;

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${politicaCobro}`);
    await tx.execute(sql`delete from ${convenioPlaca}`);
    await tx.execute(sql`delete from ${convenio}`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from ${accesoDenegado}`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-aisl-cv", name: "Admin", email: "aisl-cv@ejemplo.co" });
  });
}

beforeEach(async () => {
  await limpiar();
  idA = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Alfa CV" })).id;
  idB = (await crearParqueadero(ADMIN, { nombre: "Parqueadero Beta CV" })).id;

  const c = await declararConvenio(comoAdminDe(idB), { nombre: "Solo de B", activacion: "placa", beneficio: "porcentaje", valor: 40 });
  convenioDeB = c.id;
  await agregarPlaca(comoAdminDe(idB), c.id, "ABC123");
});

afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("A no alcanza los convenios de B", () => {
  it("la consulta de dominio desde A no los devuelve", async () => {
    expect(await conveniosDelEstablecimiento(comoAdminDe(idA))).toEqual([]);
  });

  it("la misma placa no obtiene descuento desde A", async () => {
    expect(await descuentoParaPlaca(comoAdminDe(idA), "ABC123", new Date())).toBeNull();
    expect(await descuentoParaPlaca(comoAdminDe(idB), "ABC123", new Date())).not.toBeNull();
  });

  it("las dos tablas están cerradas al ámbito de A", async () => {
    expect(await conAmbito(idA, (tx) => tx.select().from(convenio))).toEqual([]);
    expect(await conAmbito(idA, (tx) => tx.select().from(convenioPlaca))).toEqual([]);
  });

  it("A no puede vencer un convenio de B: responde como si no existiera", async () => {
    await expect(vencerConvenio(comoAdminDe(idA), convenioDeB)).rejects.toThrow(
      RecursoNoAlcanzable,
    );
  });

  it("A no puede insertar una placa en el ámbito de B", async () => {
    await expect(
      conAmbito(idA, (tx) =>
        tx.insert(convenioPlaca).values({
          convenioId: convenioDeB,
          parqueaderoId: idB,
          placa: "ZZZ999",
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("el intento queda registrado (SC-002)", () => {
  it("anota el recurso y el ámbito desde el que se intentó", async () => {
    await vencerConvenio(comoAdminDe(idA), convenioDeB).catch(() => {});

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(accesoDenegado),
    );

    expect(asientos).toHaveLength(1);
    expect(asientos[0]!.recurso).toBe(`convenio:${convenioDeB}`);
    expect(asientos[0]!.parqueaderoAmbito).toBe(idA);
  });
});

/**
 * El vocabulario nuevo no abre ninguna puerta.
 *
 * Se agrega acá y no en un archivo aparte: la garantía es la misma —A no
 * alcanza a B— y partirla en dos haría que alguien mañana extienda una y se
 * olvide de la otra.
 */
describe("los convenios de sello tampoco cruzan la frontera", () => {
  it("un convenio de sello de B no aparece en la lista de A", async () => {
    await declararConvenio(comoAdminDe(idB), {
      nombre: "Fruver de B",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 60,
    });

    const deA = await conveniosDelEstablecimiento(comoAdminDe(idA));
    expect(deA).toHaveLength(0);

    const deB = await conveniosDelEstablecimiento(comoAdminDe(idB));
    expect(deB.map((c) => c.nombre)).toContain("Fruver de B");
  });

  it("A no puede vencer un convenio de sello de B", async () => {
    const c = await declararConvenio(comoAdminDe(idB), {
      nombre: "Carnicería de B",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 30,
    });

    await expect(vencerConvenio(comoAdminDe(idA), c.id)).rejects.toThrow(RecursoNoAlcanzable);
  });
});

describe("la política de cobro es de cada establecimiento", () => {
  it("A no ve la regla de redondeo de B", async () => {
    await conAmbito(idB, (tx) =>
      tx.insert(politicaCobro).values({ parqueaderoId: idB, redondeo: "centena" }),
    );

    const desdeA = await conAmbito(idA, (tx) => tx.select().from(politicaCobro));
    expect(desdeA).toHaveLength(0);

    const desdeB = await conAmbito(idB, (tx) => tx.select().from(politicaCobro));
    expect(desdeB).toHaveLength(1);
  });

  it("A no puede escribirle una regla de redondeo a B", async () => {
    // Sería cambiarle a otro cuánto cobra. La política de la tabla lo rechaza
    // en el motor, sin depender de que nadie lo compruebe antes.
    await expect(
      conAmbito(idA, (tx) =>
        tx.insert(politicaCobro).values({ parqueaderoId: idB, redondeo: "centena" }),
      ),
    ).rejects.toThrow();
  });
});
