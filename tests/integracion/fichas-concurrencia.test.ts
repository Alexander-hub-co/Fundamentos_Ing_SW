import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { fichasDisponibles } from "@/dominio/fichas/asignar";
import { recibirBicicleta } from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * La prueba que justifica el diseño de D1.
 *
 * Dos operarios reciben bicicletas en el mismo instante. Si los dos consultan
 * "¿cuál ficha está libre?", los dos leen "la 1", y los dos la entregan, el
 * cliente que vuelve con la ficha 1 se lleva la bicicleta de otro.
 *
 * Sin el índice único parcial y el `FOR UPDATE SKIP LOCKED`, esto falla. Con
 * ellos, cada recepción se lleva una ficha distinta y nadie ve un error.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-conc", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-conc",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-conc",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

const AHORA = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
})();

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-conc", name: "Operario", email: "conc@ejemplo.co" });
  });
}

async function conBicicletas(cuantas: number) {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Concurrencia" });
  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const bici = tipos.find((t) => t.codigo === "bicicleta")!;

  await declararTarifa(comoAdminDe(p.id), {
    tipoVehiculoId: bici.id,
    modelo: "por_intervalo",
    intervaloMinutos: 30,
    valorIntervalo: 500,
    tarifaPlena: 4_000,
    alcancePlena: "jornada",
  });
  await declararCapacidad(comoAdminDe(p.id), bici.id, cuantas);

  return p.id;
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("dos taquillas recibiendo a la vez", () => {
  it("cinco recepciones simultáneas se llevan cinco fichas DISTINTAS", async () => {
    const parqueaderoId = await conBicicletas(20);
    const ctx = comoOperario(parqueaderoId);

    const resultados = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        recibirBicicleta(ctx, { nombre: `Cliente ${n}`, cedula: `100000${n}`, telefono: `300000000${n}` }, AHORA),
      ),
    );

    const fichasUsadas = resultados.map((m) => m.fichaNumero);
    expect(new Set(fichasUsadas).size).toBe(5);
    expect(fichasUsadas.every((f) => f !== null)).toBe(true);

    // Y son los cinco primeros números, sin huecos.
    expect([...fichasUsadas].sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5]);
    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 15, total: 20 });
  });

  it("con exactamente dos fichas y tres recepciones a la vez, la tercera falla y las otras no", async () => {
    // El caso límite: no basta con no duplicar, hay que agotar bien. Dos
    // bicicletas quedan adentro con ficha propia y la tercera recibe un mensaje
    // que se entiende, no un error del motor.
    const parqueaderoId = await conBicicletas(2);
    const ctx = comoOperario(parqueaderoId);

    const resultados = await Promise.allSettled(
      [1, 2, 3].map((n) =>
        recibirBicicleta(ctx, { nombre: `Cliente ${n}`, cedula: `200000${n}`, telefono: `300000000${n}` }, AHORA),
      ),
    );

    const logradas = resultados.filter((r) => r.status === "fulfilled");
    const fallidas = resultados.filter((r) => r.status === "rejected");

    expect(logradas).toHaveLength(2);
    expect(fallidas).toHaveLength(1);
    expect(String((fallidas[0] as PromiseRejectedResult).reason)).toMatch(
      /No hay espacio para más bicicletas/,
    );

    const usadas = logradas.map(
      (r) => (r as PromiseFulfilledResult<{ fichaNumero: number | null }>).value.fichaNumero,
    );
    expect(new Set(usadas).size).toBe(2);
  });

  it("la garantía vive en la base: insertar a mano dos movimientos con la misma ficha falla", async () => {
    // Lo que hace que esto sobreviva a cualquier código futuro que inserte un
    // movimiento sin pasar por el dominio. Sin este índice, todo lo demás es
    // una convención que alguien romperá.
    const parqueaderoId = await conBicicletas(3);
    const ctx = comoOperario(parqueaderoId);

    const primero = await recibirBicicleta(
      ctx,
      { nombre: "Cliente uno", cedula: "3000001", telefono: "3003000001" },
      AHORA,
    );

    await expect(
      comoPlataforma("administracion_plataforma", (tx) =>
        tx.execute(sql`
          insert into movimiento
            (parqueadero_id, codigo, placa, ficha_numero, nombre, cedula, telefono, tipo_vehiculo_id, entrada_en, operario_entrada)
          select ${parqueaderoId}, 'PQC-999999', null, ${primero.fichaNumero}, 'Otro', '3000002', '3003000002',
                 tipo_vehiculo_id, now(), 'u-conc'
            from movimiento where id = ${primero.id}
        `),
      ),
    ).rejects.toThrow();
  });
});
