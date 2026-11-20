import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tarifa, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa, TarifaInvalida } from "@/dominio/tarifas/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { fichasDisponibles } from "@/dominio/fichas/asignar";
import { crearTurno } from "@/dominio/turnos/gestionar";
import { abrirSesion, cerrarSesion } from "@/dominio/turnos/sesiones";
import { resolverPlaca } from "@/dominio/taquilla/resolver";
import { comprobanteDe } from "@/dominio/taquilla/comprobante";
import {
  devolverBicicleta,
  recibirBicicleta,
  registrarEntrada,
  registrarSalida,
  TaquillaInvalida,
} from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Los diez casos de prueba del documento `Casos_de_prueba.docx`.
 *
 * Cada `describe` lleva el identificador del caso (CP-01 … CP-10) para que el
 * informe pueda citar la prueba que lo ejecuta. Los pasos y los datos son los
 * del documento, una vez corregidos contra la especificación.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-cp", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-cp",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-cp",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

/** Mañana a las diez: después de la vigencia de las tarifas y sin cruzar medianoche. */
const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
})();
const horas = (h: number) => new Date(BASE.getTime() + h * 60 * 60 * 1000);

const ANA = { nombre: "Ana Ruiz", cedula: "1020304050", telefono: "3001234567" };

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
      id: "u-cp",
      name: "Operario",
      email: "cp@ejemplo.co",
      codigo: "OP-01",
    });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

/**
 * Carro: $700 cada 15 min, plena $18.000 por jornada.
 * Bicicleta: $500 cada 30 min, plena $4.000, con diez fichas.
 */
async function establecimiento() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Casos" });
  const admin = comoAdminDe(p.id);
  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;
  const moto = tipos.find((t) => t.codigo === "motocicleta")!;
  const bici = tipos.find((t) => t.codigo === "bicicleta")!;

  await declararTarifa(admin, {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 18_000,
    alcancePlena: "jornada",
  });
  await declararTarifa(admin, {
    tipoVehiculoId: bici.id,
    modelo: "por_intervalo",
    intervaloMinutos: 30,
    valorIntervalo: 500,
    tarifaPlena: 4_000,
    alcancePlena: "jornada",
  });
  await declararCapacidad(admin, bici.id, 10);

  return { parqueaderoId: p.id, auto, moto, bici };
}

describe("CP-01 · CU-04 Configurar el cobro", () => {
  it("la nueva tarifa queda vigente y la anterior se cierra", async () => {
    const { parqueaderoId, auto } = await establecimiento();

    const nueva = await declararTarifa(comoAdminDe(parqueaderoId), {
      tipoVehiculoId: auto.id,
      modelo: "por_minuto",
      tarifaMinima: 2_000,
      valorMinuto: 50,
      tarifaPlena: 20_000,
      alcancePlena: "jornada",
    });

    const versiones = await conAmbito(parqueaderoId, (tx) =>
      tx
        .select()
        .from(tarifa)
        .where(and(eq(tarifa.parqueaderoId, parqueaderoId), eq(tarifa.tipoVehiculoId, auto.id))),
    );

    expect(versiones).toHaveLength(2);
    const vigentes = versiones.filter((v) => v.vigenteHasta === null);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0]!.id).toBe(nueva.id);
    expect(vigentes[0]!.modelo).toBe("por_minuto");

    const anterior = versiones.find((v) => v.id !== nueva.id)!;
    expect(anterior.vigenteHasta).not.toBeNull();
  });
});

describe("CP-02 · HU-09 Entrada con placa AB1234", () => {
  it("la placa AB1234 se acepta: tiene seis caracteres y termina en dígito, así que es carro", async () => {
    const { parqueaderoId, auto } = await establecimiento();

    const mov = await registrarEntrada(comoOperario(parqueaderoId), "AB1234", horas(0));

    expect(mov.placa).toBe("AB1234");
    expect(mov.tipoVehiculoId).toBe(auto.id);
    expect(mov.salidaEn).toBeNull();
  });
});

describe("CP-03 · CU-07 Registrar la entrada de un vehículo", () => {
  it("la placa se normaliza, se deduce carro, se muestra la tarifa y queda el comprobante", async () => {
    const { parqueaderoId, auto } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);

    const consulta = await resolverPlaca(ctx, "abc-123", horas(0));
    expect(consulta.tipo).toBe("entrada");
    if (consulta.tipo !== "entrada") return;
    expect(consulta.placa).toBe("ABC123");
    expect(consulta.tipoVehiculoId).toBe(auto.id);
    expect(consulta.sinTarifa).toBe(false);

    const mov = await registrarEntrada(ctx, "abc-123", horas(0));
    expect(mov.placa).toBe("ABC123");
    expect(mov.entradaEn).toEqual(horas(0));
    expect(mov.salidaEn).toBeNull();

    const c = await comprobanteDe(ctx, mov.id);
    expect(c.rotulo).toBe("ABC123");
    expect(c.codigo).toBe(mov.codigo);
  });
});

describe("CP-04 · CU-09 Recibir una bicicleta", () => {
  it("se asigna la ficha libre más baja y el comprobante la destaca", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);

    const mov = await recibirBicicleta(ctx, ANA, horas(0));

    expect(mov.fichaNumero).toBe(1);
    expect(mov.placa).toBeNull();
    expect(mov.cedula).toBe("1020304050");
    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 9, total: 10 });

    const c = await comprobanteDe(ctx, mov.id);
    expect(c.rotulo).toBe("Ficha 1");
  });
});

describe("CP-05 · CU-10 Devolver una bicicleta", () => {
  it("el número se reconoce como ficha, se cobra con la tarifa de bicicleta y la ficha se libera", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);
    await recibirBicicleta(ctx, ANA, horas(0));

    const consulta = await resolverPlaca(ctx, "1", horas(3));
    expect(consulta.tipo).toBe("salida");
    if (consulta.tipo !== "salida") return;
    expect(consulta.cobro.importe).toBe(3_000); // seis medias horas de $500

    const cerrado = await devolverBicicleta(ctx, consulta.movimiento.id, horas(3));
    expect(cerrado.salidaEn).toEqual(horas(3));
    expect(cerrado.importe).toBe(3_000);
    expect(await fichasDisponibles(ctx)).toEqual({ disponibles: 10, total: 10 });
  });
});

describe("CP-06 · CU-11 Gestionar el turno propio", () => {
  it("guarda las horas reales y atribuye a la sesión los movimientos atendidos", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);
    const turno = await crearTurno(comoAdminDe(parqueaderoId), {
      nombre: "Mañana",
      horaInicio: "07:00",
      horaFin: "15:00",
      dias: [0, 1, 2, 3, 4, 5, 6],
    });

    const llegada = new Date(BASE.getTime() - 3 * 60 * 60 * 1000 + 7 * 60 * 1000); // 7:07
    const sesion = await abrirSesion(ctx, turno.id, llegada);
    expect(sesion.abiertaEn).toEqual(llegada);
    expect(sesion.programadaInicio).toContain("07:00");

    const mov = await registrarEntrada(ctx, "ABC123", horas(0));
    expect(mov.sesionEntrada).toBe(sesion.id);

    const salida = horas(5);
    const cerrada = await cerrarSesion(ctx, sesion.id, salida);
    expect(cerrada.cerradaEn).toEqual(salida);
  });
});

describe("CP-07 · CU-08 Cobrar la salida de un vehículo", () => {
  it("cinco horas a $700 cada 15 minutos son $14.000", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);
    const entrada = await registrarEntrada(ctx, "ABC123", horas(0));

    const consulta = await resolverPlaca(ctx, "ABC123", horas(5));
    expect(consulta.tipo).toBe("salida");
    if (consulta.tipo !== "salida") return;
    expect(consulta.minutosDentro).toBe(300);
    expect(consulta.cobro.importe).toBe(14_000);

    const cerrado = await registrarSalida(ctx, entrada.id, horas(5));
    expect(cerrado.importe).toBe(14_000);
    expect(cerrado.salidaEn).toEqual(horas(5));
  });
});

describe("CP-08 · Placa que ya está adentro", () => {
  it("una segunda entrada de la misma placa, escrita distinto, se rechaza", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);
    await registrarEntrada(ctx, "ABC123", horas(0));

    await expect(registrarEntrada(ctx, "abc 123", horas(1))).rejects.toThrow(
      new TaquillaInvalida("La placa ABC123 ya está adentro"),
    );

    // Y la consulta la ofrece como salida, no como otra entrada.
    const consulta = await resolverPlaca(ctx, "abc 123", horas(1));
    expect(consulta.tipo).toBe("salida");
  });
});

describe("CP-09 · Valores límite del largo de la placa", () => {
  it.each([
    ["ABC1", "rechazada"],
    ["ABC12", "carro"],
    ["ABC12D", "moto"],
    ["ABCD1234", "carro"],
    ["ABCD12345", "rechazada"],
  ])("«%s» → %s", async (placa, esperado) => {
    const { parqueaderoId, auto, moto } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);

    if (esperado === "rechazada") {
      await expect(registrarEntrada(ctx, placa, horas(0))).rejects.toThrow(/no tiene forma de placa/);
      return;
    }

    const mov = await registrarEntrada(ctx, placa, horas(0));
    expect(mov.tipoVehiculoId).toBe(esperado === "carro" ? auto.id : moto.id);
  });
});

describe("CP-10 · HU-2.1.2 Rechazar tarifas incoherentes", () => {
  it.each([
    [
      "intervalo de cero minutos",
      { modelo: "por_intervalo", intervaloMinutos: 0, valorIntervalo: 700, tarifaPlena: 18_000 },
      "La duración del intervalo debe ser mayor que cero",
    ],
    [
      "importe negativo",
      { modelo: "por_intervalo", intervaloMinutos: 15, valorIntervalo: -700, tarifaPlena: 18_000 },
      "Los importes no pueden ser negativos",
    ],
    [
      "mínima mayor que la plena",
      { modelo: "por_minuto", tarifaMinima: 25_000, valorMinuto: 50, tarifaPlena: 18_000 },
      "La tarifa mínima no puede superar a la plena: ninguna estadía sería cobrable",
    ],
    [
      "valores de otro modelo",
      {
        modelo: "por_minuto",
        tarifaMinima: 2_000,
        valorMinuto: 50,
        intervaloMinutos: 15,
        tarifaPlena: 18_000,
      },
      "El cobro por minuto no lleva intervalo: esos valores son del otro modelo",
    ],
  ] as const)("%s", async (_caso, datos, mensaje) => {
    const { parqueaderoId, auto } = await establecimiento();

    await expect(
      declararTarifa(comoAdminDe(parqueaderoId), {
        tipoVehiculoId: auto.id,
        alcancePlena: "jornada",
        ...datos,
      }),
    ).rejects.toThrow(new TarifaInvalida(mensaje));

    // La tarifa que regía sigue siendo la única vigente.
    const vigentes = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(tarifa).where(eq(tarifa.tipoVehiculoId, auto.id)),
    );
    expect(vigentes.filter((v) => v.vigenteHasta === null)).toHaveLength(1);
  });
});
