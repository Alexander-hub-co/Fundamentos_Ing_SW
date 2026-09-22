import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { movimiento, parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { resolverPlaca } from "@/dominio/taquilla/resolver";
import {
  registrarCortesia,
  registrarEntrada,
  registrarSalida,
  TaquillaInvalida,
} from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero } from "@/db/esquema";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Historia 1 — el ciclo del vehículo.
 *
 * La primera vez que el sistema maneja dinero cobrado de verdad. Hasta ahora un
 * error en el cálculo producía un número equivocado en una pantalla de prueba;
 * a partir de aquí produce un cobro real.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-taq", rol: "admin_general" };

const comoOperario = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-taq",
  rol: "operario",
  parqueaderoId,
  estado,
});
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-taq",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

/**
 * Los instantes van DESPUÉS de ahora, no en una fecha fija del pasado.
 *
 * La tarifa se declara al preparar cada prueba, con vigencia desde ese momento,
 * así que una entrada fechada ayer no encontraría ninguna tarifa vigente —y el
 * sistema haría bien en decirlo—. Es la primera trampa de probar algo que
 * depende de versiones por rango.
 */
const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Y a las diez de la mañana, no a la hora que sea. Una ventana de cinco horas
  // que arranque de noche cruzaría la medianoche, el motor la partiría en dos
  // jornadas y redondearía los intervalos en cada una: 21 en vez de 20. El
  // cálculo estaría bien y la prueba sería frágil.
  d.setHours(10, 0, 0, 0);
  return d;
})();
const ENTRADA = new Date(BASE);
const SALIDA = new Date(BASE.getTime() + 5 * 60 * 60 * 1000); // cinco horas

async function limpiar() {
  // Los movimientos van aparte, por el rol dueño: el disparador de
  // inmutabilidad no deja borrarlos desde ninguno de los roles que usa la
  // aplicación, que es exactamente lo que se quiere.
  await limpiarMovimientos();

  await comoPlataforma("administracion_plataforma", async (tx) => {
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
    await tx.insert(usuario).values({ id: "u-taq", name: "Operario", email: "taq@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

/** Un establecimiento con tarifa para carros: $700 cada 15 min, plena $18.000. */
async function conTarifas() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Taquilla" });
  const admin = comoAdminDe(p.id);

  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;

  await declararTarifa(admin, {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 18_000,
    alcancePlena: "jornada",
  });

  return { parqueaderoId: p.id, autoId: auto.id, tipos };
}

describe("un dato basta para entrar", () => {
  it("la placa que termina en dígito entra como automóvil, sin que nadie elija el tipo", async () => {
    const { parqueaderoId, autoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "abc 123", ENTRADA);

    expect(mov.placa).toBe("ABC123");
    expect(mov.tipoVehiculoId).toBe(autoId);
    expect(mov.salidaEn).toBeNull();
    expect(mov.operarioEntrada).toBe("u-taq");
  });

  it("la placa que termina en letra entra como motocicleta", async () => {
    const { parqueaderoId, tipos } = await conTarifas();
    const moto = tipos.find((t) => t.codigo === "motocicleta")!;

    const mov = await registrarEntrada(comoOperario(parqueaderoId), "ABC12D", ENTRADA);
    expect(mov.tipoVehiculoId).toBe(moto.id);
  });

  it("el movimiento nace con código legible y con la sigla del establecimiento", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await registrarEntrada(comoOperario(parqueaderoId), "ABC123", ENTRADA);

    // Alguien va a tener que leerlo por teléfono o escribirlo cuando el papel
    // térmico se borre.
    expect(mov.codigo).toMatch(/^[A-Z]{2,4}-\d{6}$/);
  });

  it("los códigos son correlativos y no se repiten", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const uno = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const dos = await registrarEntrada(ctx, "XYZ456", ENTRADA);

    const n = (c: string) => Number.parseInt(c.split("-")[1]!, 10);
    expect(n(dos.codigo)).toBe(n(uno.codigo) + 1);
  });

  it("el comprobante nace pendiente: registrar y emitir son dos pasos", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await registrarEntrada(comoOperario(parqueaderoId), "ABC123", ENTRADA);
    expect(mov.comprobante).toBe("pendiente");
  });
});

describe("el mismo campo resuelve la salida", () => {
  it("con el vehículo adentro, escribir la placa ofrece salir y no entrar otra vez", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    await registrarEntrada(ctx, "ABC123", ENTRADA);

    const r = await resolverPlaca(ctx, "abc123", SALIDA);

    expect(r.tipo).toBe("salida");
    if (r.tipo === "salida") {
      expect(r.minutosDentro).toBe(300);
      // Cinco horas: 20 intervalos de 15 min a $700.
      expect(r.cobro.importe).toBe(14_000);
    }
  });

  it("sin el vehículo adentro, la misma placa propone entrar", async () => {
    const { parqueaderoId } = await conTarifas();
    const r = await resolverPlaca(comoOperario(parqueaderoId), "ABC123", ENTRADA);

    expect(r.tipo).toBe("entrada");
    if (r.tipo === "entrada") {
      expect(r.tipoNombre).toBe("Automóvil");
      expect(r.sinTarifa).toBe(false);
      expect(r.tarifa).toContain("700");
    }
  });

  it("avisa cuando el tipo no tiene tarifa: es un vehículo que no se va a poder cobrar", async () => {
    const { parqueaderoId } = await conTarifas();
    // La moto no tiene tarifa declarada en este establecimiento.
    const r = await resolverPlaca(comoOperario(parqueaderoId), "ABC12D", ENTRADA);

    expect(r.tipo === "entrada" && r.sinTarifa).toBe(true);
  });

  it("una placa sin forma de placa se rechaza con un motivo, no se adivina", async () => {
    const { parqueaderoId } = await conTarifas();
    const r = await resolverPlaca(comoOperario(parqueaderoId), "XX", ENTRADA);

    expect(r.tipo).toBe("rechazada");
    if (r.tipo === "rechazada") expect(r.motivo).toMatch(/no tiene forma de placa/);
  });
});

describe("cerrar el movimiento", () => {
  it("guarda los dos operarios y las dos marcas de tiempo", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);

    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    expect(cerrado.salidaEn).toEqual(SALIDA);
    expect(cerrado.entradaEn).toEqual(ENTRADA);
    expect(cerrado.operarioEntrada).toBe("u-taq");
    expect(cerrado.operarioSalida).toBe("u-taq");
    expect(cerrado.importe).toBe(14_000);
  });

  it("guarda la copia del desglose, no una referencia", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    const cobro = cerrado.cobro as { importeBase: number; beneficios: unknown[] };
    expect(cobro.importeBase).toBe(14_000);
    expect(Array.isArray(cobro.beneficios)).toBe(true);
  });

  it("un movimiento ya cerrado no se cierra dos veces", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await registrarSalida(ctx, abierto.id, SALIDA);

    await expect(registrarSalida(ctx, abierto.id, SALIDA)).rejects.toThrow();
  });

  it("cerrado el movimiento, la misma placa puede volver a entrar", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const primero = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await registrarSalida(ctx, primero.id, SALIDA);

    const segundo = await registrarEntrada(ctx, "ABC123", new Date(BASE.getTime() + 6 * 60 * 60 * 1000));
    expect(segundo.id).not.toBe(primero.id);
  });
});

describe("la cortesía", () => {
  it("sin motivo no cierra", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);

    await expect(registrarCortesia(ctx, abierto.id, "   ", SALIDA)).rejects.toThrow(
      TaquillaInvalida,
    );
  });

  it("con motivo cierra en cero, y guarda cuánto se habría cobrado", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);

    const cerrado = await registrarCortesia(ctx, abierto.id, "Carro del dueño", SALIDA);

    expect(cerrado.importe).toBe(0);
    expect(cerrado.cortesiaMotivo).toBe("Carro del dueño");
    expect(cerrado.cortesiaPor).toBe("u-taq");
    // Sin este número no se puede medir lo que las cortesías cuestan.
    expect(cerrado.cortesiaImporteOmitido).toBe(14_000);
  });

  it("se distingue de un cobro que dio cero", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const a = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cortesia = await registrarCortesia(ctx, a.id, "Personal", SALIDA);

    const b = await registrarEntrada(ctx, "XYZ456", ENTRADA);
    const cobrado = await registrarSalida(ctx, b.id, SALIDA);

    // Los dos están cerrados; sólo uno es una decisión de no cobrar.
    expect(cortesia.cortesiaMotivo).not.toBeNull();
    expect(cobrado.cortesiaMotivo).toBeNull();
  });
});

describe("el modo restringido", () => {
  it("suspendido no entra nadie", async () => {
    const { parqueaderoId } = await conTarifas();
    const suspendido = comoOperario(parqueaderoId, "suspendido");

    await expect(registrarEntrada(suspendido, "ABC123", ENTRADA)).rejects.toThrow();
  });

  it("pero los que están adentro sí salen", async () => {
    // Dejar vehículos atrapados por una decisión administrativa sería
    // inaceptable, y por eso entrar y salir son operaciones distintas.
    const { parqueaderoId } = await conTarifas();
    const abierto = await registrarEntrada(comoOperario(parqueaderoId), "ABC123", ENTRADA);

    const suspendido = comoOperario(parqueaderoId, "suspendido");
    const cerrado = await registrarSalida(suspendido, abierto.id, SALIDA);

    expect(cerrado.salidaEn).toEqual(SALIDA);
  });

  it("y también se pueden cerrar como cortesía", async () => {
    const { parqueaderoId } = await conTarifas();
    const abierto = await registrarEntrada(comoOperario(parqueaderoId), "ABC123", ENTRADA);

    const suspendido = comoOperario(parqueaderoId, "suspendido");
    const cerrado = await registrarCortesia(suspendido, abierto.id, "Cierre", SALIDA);
    expect(cerrado.importe).toBe(0);
  });
});

describe("el administrador también atiende", () => {
  it("puede registrar entradas y salidas como un operario", async () => {
    // Hay parqueaderos donde el administrador trabaja en taquilla.
    const { parqueaderoId } = await conTarifas();
    const admin = comoAdminDe(parqueaderoId);

    const abierto = await registrarEntrada(admin, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(admin, abierto.id, SALIDA);
    expect(cerrado.importe).toBe(14_000);
  });
});

describe("cuántos hay adentro", () => {
  it("un movimiento sin salida es un vehículo adentro", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    await registrarEntrada(ctx, "ABC123", ENTRADA);
    await registrarEntrada(ctx, "XYZ456", ENTRADA);

    const adentro = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(eq(movimiento.parqueaderoId, parqueaderoId)),
    );
    expect(adentro.filter((m) => m.salidaEn === null)).toHaveLength(2);
  });
});
