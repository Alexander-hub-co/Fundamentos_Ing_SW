import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tarifa, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa, TarifaInvalida } from "@/dominio/tarifas/declarar";
import { declararCapacidad } from "@/dominio/capacidad/declarar";
import { cobrosDelPeriodo } from "@/dominio/reportes/cobros";
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
 * #8 · Búsqueda en el historial por placa y por fecha.
 *
 * El propietario tiene que encontrar un cobro sin ir al parqueadero, y cuando
 * no hay nada la pantalla tiene que poder decir "sin resultados".
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

const fechaDe = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

describe("búsqueda en el historial", () => {
  it("por placa encuentra el cobro aunque se escriba distinto, en todo el historial", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);
    const a = await registrarEntrada(ctx, "ABC123", horas(0));
    await registrarSalida(ctx, a.id, horas(1));
    const b = await registrarEntrada(ctx, "XYZ789", horas(0));
    await registrarSalida(ctx, b.id, horas(2));

    const r = await cobrosDelPeriodo(comoAdminDe(parqueaderoId), "hoy", horas(3), {
      placa: "abc-123",
    });

    expect(r.filtro.placa).toBe("ABC123");
    expect(r.cobros.map((c) => c.rotulo)).toEqual(["ABC123"]);
  });

  it("por fecha devuelve solo lo que salió ese día", async () => {
    const { parqueaderoId } = await establecimiento();
    const ctx = comoOperario(parqueaderoId);
    const a = await registrarEntrada(ctx, "ABC123", horas(0));
    await registrarSalida(ctx, a.id, horas(1));

    const ese = await cobrosDelPeriodo(comoAdminDe(parqueaderoId), "hoy", horas(3), {
      fecha: fechaDe(horas(1)),
    });
    const otro = await cobrosDelPeriodo(comoAdminDe(parqueaderoId), "hoy", horas(3), {
      fecha: fechaDe(horas(48)),
    });

    expect(ese.cobros).toHaveLength(1);
    expect(otro.cobros).toHaveLength(0);
  });

  it("sin coincidencias devuelve una lista vacía, no un error", async () => {
    const { parqueaderoId } = await establecimiento();

    const r = await cobrosDelPeriodo(comoAdminDe(parqueaderoId), "hoy", horas(0), {
      placa: "NOEXISTE1",
    });

    expect(r.cobros).toEqual([]);
    expect(r.total).toBe(0);
  });
});
