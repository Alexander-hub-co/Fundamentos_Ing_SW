import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { recibirBicicleta } from "@/dominio/taquilla/registrar";
import { buscarPorCedula, resolverPlaca } from "@/dominio/taquilla/resolver";
import { fichasDisponibles } from "@/dominio/fichas/asignar";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Prueba negativa del Principio I sobre fichas de bicicleta.
 *
 * Las fichas se numeran desde 1 en CADA establecimiento, así que la ficha 7
 * existe en los dos a la vez y son bicicletas distintas. Es el caso donde una
 * fuga de ámbito sería más fácil de no notar: los números coinciden, y una
 * consulta mal acotada devolvería algo que parece correcto —una bicicleta, con
 * su hora y su cobro— pero es la de otro local.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-aisl-fi", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-fi",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-fi",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

const AHORA = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
})();

let idA: string;
let idB: string;

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-aisl-fi", name: "Admin", email: "fi@ejemplo.co" });
  });
}

async function prepararBicicletas(parqueaderoId: string) {
  const tipos = await conAmbito(parqueaderoId, (tx) => tx.select().from(tipoVehiculo));
  const bici = tipos.find((t) => t.codigo === "bicicleta")!;

  await declararTarifa(comoAdminDe(parqueaderoId), {
    tipoVehiculoId: bici.id,
    modelo: "por_intervalo",
    intervaloMinutos: 30,
    valorIntervalo: 500,
    tarifaPlena: 4_000,
    alcancePlena: "jornada",
  });
  await declararCapacidad(comoAdminDe(parqueaderoId), bici.id, 20);
}

beforeEach(async () => {
  await limpiar();
  const a = await crearParqueadero(ADMIN, { nombre: "Parqueadero A" });
  const b = await crearParqueadero(ADMIN, { nombre: "Parqueadero B" });
  idA = a.id;
  idB = b.id;

  await prepararBicicletas(idA);
  await prepararBicicletas(idB);
});

afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("la ficha 7 de A no es la ficha 7 de B", () => {
  it("los dos establecimientos usan la misma numeración sin estorbarse", async () => {
    const enA = await recibirBicicleta(
      comoOperario(idA),
      { nombre: "Ana", cedula: "1111111", telefono: "3001111111" },
      AHORA,
    );
    const enB = await recibirBicicleta(
      comoOperario(idB),
      { nombre: "Beto", cedula: "2222222", telefono: "3002222222" },
      AHORA,
    );

    // Los dos reciben el número 1: la numeración es de cada local.
    expect(enA.fichaNumero).toBe(1);
    expect(enB.fichaNumero).toBe(1);
    expect(enA.id).not.toBe(enB.id);
  });

  it("resolver un número devuelve la bicicleta del propio local, no la del otro", async () => {
    await recibirBicicleta(
      comoOperario(idA),
      { nombre: "Ana", cedula: "1111111", telefono: "3001111111" },
      AHORA,
    );

    // En B nadie dejó una bicicleta, así que su ficha 1 no existe aunque en A sí.
    const enB = await resolverPlaca(comoOperario(idB), "1", AHORA);
    expect(enB.tipo).toBe("rechazada");

    const enA = await resolverPlaca(comoOperario(idA), "1", AHORA);
    expect(enA.tipo).toBe("salida");
  });

  it("la búsqueda por cédula no cruza establecimientos", async () => {
    // El caso peor: la misma persona deja bicicleta en los dos locales.
    await recibirBicicleta(
      comoOperario(idA),
      { nombre: "Ana", cedula: "1020304050", telefono: "3001111111" },
      AHORA,
    );
    await recibirBicicleta(
      comoOperario(idB),
      { nombre: "Ana", cedula: "1020304050", telefono: "3001111111" },
      AHORA,
    );

    expect(await buscarPorCedula(comoOperario(idA), "1020304050")).toHaveLength(1);
    expect(await buscarPorCedula(comoOperario(idB), "1020304050")).toHaveLength(1);
  });

  it("el conteo de fichas libres es el del propio local", async () => {
    await recibirBicicleta(
      comoOperario(idA),
      { nombre: "Ana", cedula: "1111111", telefono: "3001111111" },
      AHORA,
    );

    expect(await fichasDisponibles(comoOperario(idA))).toEqual({ disponibles: 19, total: 20 });
    expect(await fichasDisponibles(comoOperario(idB))).toEqual({ disponibles: 20, total: 20 });
  });
});
