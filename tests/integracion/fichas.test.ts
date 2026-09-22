import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { fichasDisponibles } from "@/dominio/fichas/asignar";
import {
  cerrarSinFicha,
  devolverBicicleta,
  recibirBicicleta,
  registrarCortesia,
  registrarEntrada,
  TaquillaInvalida,
} from "@/dominio/taquilla/registrar";
import { buscarPorCedula, resolverPlaca, telefonoConocidoDe } from "@/dominio/taquilla/resolver";
import { vehiculosAdentro } from "@/dominio/taquilla/ocupacion";
import { rotuloDe } from "@/dominio/taquilla/rotulo";
import { comprobanteDe } from "@/dominio/taquilla/comprobante";
import { comprobanteHtml } from "@/app/(establecimiento)/taquilla/comprobante-html";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * F4 — el ciclo de una bicicleta.
 *
 * **Una ficha es el ticket, no un tarjetón.** Es el mismo papel que sale para
 * un carro, que en vez de una placa lleva un número. No hay nada físico que el
 * cliente devuelva, así que no hay inventario, ni estados, ni reposiciones. Y
 * cuántas fichas hay ES la capacidad de bicicletas declarada: un espacio es una
 * ficha.
 *
 * Lo que sí es propio de esta funcionalidad: el número se reutiliza en cuanto
 * la bicicleta sale, y dos operarios no pueden entregar el mismo a la vez.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-bici", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-bici",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-bici",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
})();
const ENTRADA = new Date(BASE);
const SALIDA = new Date(BASE.getTime() + 3 * 60 * 60 * 1000);

const ANA = { nombre: "Ana Ruiz", cedula: "1020304050", telefono: "3001234567" };
const OTRO = { nombre: "Beto Díaz", cedula: "9999999", telefono: "3009999999" };

async function limpiar() {
  await limpiarMovimientos();
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from delegacion`);
    await tx.execute(sql`delete from sesion_turno`);
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from politica_cobro`);
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-bici",
      name: "Operario",
      email: "bici@ejemplo.co",
      codigo: "OP-07",
    });
  });
}

/** Tarifa de bicicleta: $500 cada 30 min, plena $4.000. Y `cupos` espacios. */
async function conBicicletas(cupos = 20) {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Bicis" });
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
  if (cupos > 0) await declararCapacidad(comoAdminDe(p.id), bici.id, cupos);

  return { parqueaderoId: p.id, biciId: bici.id };
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("cuántas fichas hay es la capacidad declarada", () => {
  it("veinte espacios de bicicleta son veinte fichas", async () => {
    const { parqueaderoId } = await conBicicletas(20);
    expect(await fichasDisponibles(comoOperario(parqueaderoId))).toEqual({
      disponibles: 20,
      total: 20,
    });
  });

  it("sin capacidad declarada no se puede recibir ninguna, y lo dice", async () => {
    // No es un fallo técnico: el local no declaró que tuviera dónde ponerlas.
    const { parqueaderoId } = await conBicicletas(0);

    await expect(recibirBicicleta(comoOperario(parqueaderoId), ANA, ENTRADA)).rejects.toThrow(
      /cupos de bicicleta/,
    );
    expect(await fichasDisponibles(comoOperario(parqueaderoId))).toEqual({
      disponibles: 0,
      total: 0,
    });
  });

  it("ampliar la capacidad amplía las fichas, sin tocar las que están adentro", async () => {
    const { parqueaderoId, biciId } = await conBicicletas(2);
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);
    await declararCapacidad(comoAdminDe(parqueaderoId), biciId, 10);

    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 9, total: 10 });
  });
});

describe("recibir una bicicleta", () => {
  it("se piden nombre, cédula y teléfono, y el sistema asigna el número", async () => {
    const { parqueaderoId } = await conBicicletas();
    const mov = await recibirBicicleta(comoOperario(parqueaderoId), ANA, ENTRADA);

    expect(mov.placa).toBeNull();
    expect(mov.fichaNumero).toBe(1);
    expect(mov.nombre).toBe("Ana Ruiz");
    expect(mov.cedula).toBe("1020304050");
    expect(await fichasDisponibles(comoOperario(parqueaderoId))).toEqual({
      disponibles: 19,
      total: 20,
    });
  });

  it("la segunda recibe el número siguiente", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);
    const segunda = await recibirBicicleta(ctx, OTRO, ENTRADA);
    expect(segunda.fichaNumero).toBe(2);
  });

  it("el número se REUTILIZA en cuanto la bicicleta sale", async () => {
    // Es la diferencia con un correlativo: los números corresponden a espacios,
    // y un correlativo que siguiera subiendo llegaría a números sin espacio.
    const { parqueaderoId } = await conBicicletas(3);
    const ctx = comoOperario(parqueaderoId);

    const primera = await recibirBicicleta(ctx, ANA, ENTRADA);
    const segunda = await recibirBicicleta(ctx, OTRO, ENTRADA);
    expect(segunda.fichaNumero).toBe(2);

    await devolverBicicleta(ctx, primera.id, SALIDA);

    // Sale la 1, así que la próxima bicicleta recibe la 1 otra vez.
    const tercera = await recibirBicicleta(
      ctx,
      { nombre: "Carlos Peña", cedula: "5555555", telefono: "3005555555" },
      SALIDA,
    );
    expect(tercera.fichaNumero).toBe(1);
  });

  it("faltan datos: lo dice y no registra nada", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await expect(recibirBicicleta(ctx, { ...ANA, nombre: "" }, ENTRADA)).rejects.toThrow(
      TaquillaInvalida,
    );
    await expect(recibirBicicleta(ctx, { ...ANA, cedula: "" }, ENTRADA)).rejects.toThrow(
      TaquillaInvalida,
    );
    await expect(recibirBicicleta(ctx, { ...ANA, telefono: "12" }, ENTRADA)).rejects.toThrow(
      TaquillaInvalida,
    );

    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 20, total: 20 });
  });

  it("propone el teléfono de quien ya vino", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);
    expect(await telefonoConocidoDe(ctx, "1020304050")).toBe("3001234567");
    expect(await telefonoConocidoDe(ctx, "7777777")).toBeNull();
  });

  it("cuando el parqueadero de bicicletas se llena, lo dice", async () => {
    const { parqueaderoId } = await conBicicletas(2);
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);
    await recibirBicicleta(ctx, OTRO, ENTRADA);

    await expect(
      recibirBicicleta(
        ctx,
        { nombre: "Carlos Peña", cedula: "5555555", telefono: "3005555555" },
        ENTRADA,
      ),
    ).rejects.toThrow(/No hay espacio para más bicicletas/);
  });
});

describe("devolver la bicicleta", () => {
  it("el número en el campo único da el total, igual que una placa", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);

    const r = await resolverPlaca(ctx, "1", SALIDA);
    expect(r.tipo).toBe("salida");
    if (r.tipo !== "salida") throw new Error("inesperado");

    expect(r.rotulo).toBe("Ficha 1");
    expect(r.minutosDentro).toBe(180);
    // Tres horas a $500 cada 30 min = $3.000, bajo la plena de $4.000.
    expect(r.cobro.importe).toBe(3_000);

    const cerrado = await devolverBicicleta(ctx, r.movimiento.id, SALIDA);
    expect(cerrado.importe).toBe(3_000);
    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 20, total: 20 });
  });

  it("un número sin bicicleta lo dice claramente y no cobra nada", async () => {
    const { parqueaderoId } = await conBicicletas();
    const r = await resolverPlaca(comoOperario(parqueaderoId), "3", SALIDA);

    expect(r.tipo).toBe("rechazada");
    if (r.tipo !== "rechazada") throw new Error("inesperado");
    expect(r.motivo).toMatch(/No hay ninguna bicicleta con la ficha 3/);
  });

  it("una bicicleta sale sin cobro igual que cualquier vehículo", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoAdminDe(parqueaderoId);

    const mov = await recibirBicicleta(ctx, ANA, ENTRADA);
    const cerrado = await registrarCortesia(ctx, mov.id, "Es del personal", SALIDA);

    expect(cerrado.cortesiaMotivo).toBe("Es del personal");
    expect(cerrado.cortesiaImporteOmitido).toBe(3_000);
    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 20, total: 20 });
  });
});

describe("el cliente perdió el ticket", () => {
  it("se encuentra por la cédula, con su nombre", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, { ...ANA, nota: "Negra, marca Trek" }, ENTRADA);

    const encontradas = await buscarPorCedula(ctx, "1020304050");
    expect(encontradas).toHaveLength(1);
    expect(encontradas[0]?.fichaNumero).toBe(1);
    expect(encontradas[0]?.nombre).toBe("Ana Ruiz");
    expect(encontradas[0]?.notaVehiculo).toBe("Negra, marca Trek");
  });

  it("cerrar sin el ticket es una salida normal: se cobra y el número se libera", async () => {
    // Perder el papel no le cuesta nada a nadie: la ficha ES el papel, no un
    // tarjetón que haya que reponer.
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await recibirBicicleta(ctx, ANA, ENTRADA);
    const cerrado = await cerrarSinFicha(ctx, mov.id, SALIDA);

    expect(cerrado.importe).toBe(3_000);
    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 20, total: 20 });
  });

  it("una cédula con dos bicicletas adentro devuelve las dos", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);
    await recibirBicicleta(ctx, ANA, ENTRADA);

    const encontradas = await buscarPorCedula(ctx, "1020304050");
    expect(encontradas.map((e) => e.fichaNumero).sort()).toEqual([1, 2]);
  });
});

describe("cómo se nombra una bicicleta en pantalla", () => {
  it("en «adentro ahora» dice «Ficha 1», no un hueco en blanco", async () => {
    // Salió mal la primera vez: la lista pintaba `placa` directamente, y una
    // bicicleta no tiene placa, así que el renglón aparecía vacío. Se prueba
    // sobre `rotuloDe`, que es donde vive esa decisión, para que ningún sitio
    // vuelva a pintar el campo crudo.
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);

    const adentro = await vehiculosAdentro(ctx);
    expect(adentro).toHaveLength(1);
    expect(adentro[0]?.placa).toBeNull();
    expect(adentro[0]?.fichaNumero).toBe(1);
    expect(rotuloDe(adentro[0]!)).toBe("Ficha 1");
  });

  it("un carro y una bicicleta conviven en la misma lista, cada uno con lo suyo", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    await recibirBicicleta(ctx, ANA, ENTRADA);
    await registrarEntrada(ctx, "ABC123", ENTRADA);

    const rotulos = (await vehiculosAdentro(ctx)).map(rotuloDe).sort();
    expect(rotulos).toEqual(["ABC123", "Ficha 1"]);
  });
});

describe("el ticket de una bicicleta", () => {
  it("lleva el número donde un carro lleva la placa", async () => {
    const { parqueaderoId } = await conBicicletas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await recibirBicicleta(ctx, ANA, ENTRADA);
    const c = await comprobanteDe(ctx, mov.id);

    expect(c.rotulo).toBe("Ficha 1");
    expect(c.placa).toBeNull();
    expect(c.fichaNumero).toBe(1);
    expect(comprobanteHtml(c)).toContain("Ficha 1");
  });
});
