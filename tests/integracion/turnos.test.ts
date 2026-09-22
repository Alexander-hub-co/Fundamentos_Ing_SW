import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { crearCuenta } from "@/dominio/cuentas/crear";
import {
  asignarATurno,
  cambiarEstadoTurno,
  crearTurno,
  editarTurno,
  retirarDeTurno,
  TurnoInvalido,
} from "@/dominio/turnos/gestionar";
import { turnosDelEstablecimiento, turnosVigentesEn } from "@/dominio/turnos/consultar";
import { EstablecimientoRestringido } from "@/lib/autorizacion";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/** Historia 4 — organizar quién trabaja y cuándo. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-turnos", rol: "admin_general" };
const CLAVE = "ClaveLargaSegura2026";

const comoAdminDe = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-turnos",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado,
});

const MANANA = { nombre: "Mañana", horaInicio: "07:00", horaFin: "15:00", dias: [1, 2, 3, 4, 5] };

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from horario_franja`);
    await tx.execute(sql`delete from horario_atencion`);
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from session`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-turnos", name: "Admin", email: "turnos@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

async function conGente(nombre: string) {
  const p = await crearParqueadero(ADMIN, { nombre });
  const persona = await crearCuenta(ADMIN, {
    email: `${nombre.replace(/\s+/g, "").toLowerCase()}@ejemplo.co`,
    nombre: "Operario",
    passwordTemporal: CLAVE,
    rol: "operario",
    parqueaderoId: p.id,
  });
  return { p, persona };
}

describe("crear y organizar turnos", () => {
  it("queda con su nombre, su horario y sus días", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Turnos" });
    await crearTurno(comoAdminDe(p.id), MANANA);

    const [t] = await turnosDelEstablecimiento(comoAdminDe(p.id));
    expect(t!.nombre).toBe("Mañana");
    expect(t!.dias).toEqual([1, 2, 3, 4, 5]);
    expect(t!.activo).toBe(true);
  });

  it("editar reemplaza los días en vez de acumularlos", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Editar" });
    const ctx = comoAdminDe(p.id);
    const creado = await crearTurno(ctx, MANANA);

    await editarTurno(ctx, creado.id, { ...MANANA, nombre: "Mañana corta", dias: [6] });

    const [t] = await turnosDelEstablecimiento(ctx);
    expect(t!.nombre).toBe("Mañana corta");
    expect(t!.dias).toEqual([6]);
  });

  it("desactivar no borra: el turno sigue existiendo", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Apagar" });
    const ctx = comoAdminDe(p.id);
    const creado = await crearTurno(ctx, MANANA);

    await cambiarEstadoTurno(ctx, creado.id, false);

    const [t] = await turnosDelEstablecimiento(ctx);
    expect(t!.activo).toBe(false);
    expect(turnosVigentesEn([t!], new Date("2026-08-17T10:00:00-05:00"))).toEqual([]);
  });

  it("rechaza un nombre vacío, horas iguales y ningún día", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Malo" });
    const ctx = comoAdminDe(p.id);

    await expect(crearTurno(ctx, { ...MANANA, nombre: "  " })).rejects.toThrow(TurnoInvalido);
    await expect(crearTurno(ctx, { ...MANANA, horaFin: "07:00" })).rejects.toThrow(TurnoInvalido);
    await expect(crearTurno(ctx, { ...MANANA, dias: [] })).rejects.toThrow(TurnoInvalido);
  });
});

describe("asignar gente a los turnos", () => {
  it("una persona del establecimiento se asigna y se retira", async () => {
    const { p, persona } = await conGente("Parqueadero Gente");
    const ctx = comoAdminDe(p.id);
    const t = await crearTurno(ctx, MANANA);

    await asignarATurno(ctx, t.id, persona.usuarioId);
    expect((await turnosDelEstablecimiento(ctx))[0]!.personas).toHaveLength(1);

    await retirarDeTurno(ctx, t.id, persona.usuarioId);
    expect((await turnosDelEstablecimiento(ctx))[0]!.personas).toEqual([]);
  });

  it("asignar dos veces no duplica", async () => {
    const { p, persona } = await conGente("Parqueadero Doble");
    const ctx = comoAdminDe(p.id);
    const t = await crearTurno(ctx, MANANA);

    await asignarATurno(ctx, t.id, persona.usuarioId);
    await asignarATurno(ctx, t.id, persona.usuarioId);

    expect((await turnosDelEstablecimiento(ctx))[0]!.personas).toHaveLength(1);
  });

  it("rechaza a alguien que no pertenece al establecimiento", async () => {
    const { p } = await conGente("Parqueadero Propio");
    const otro = await conGente("Parqueadero Ajeno");
    const ctx = comoAdminDe(p.id);
    const t = await crearTurno(ctx, MANANA);

    await expect(asignarATurno(ctx, t.id, otro.persona.usuarioId)).rejects.toThrow(TurnoInvalido);
  });

  it("una persona puede cubrir varios turnos", async () => {
    const { p, persona } = await conGente("Parqueadero Varios");
    const ctx = comoAdminDe(p.id);
    const m = await crearTurno(ctx, MANANA);
    const t = await crearTurno(ctx, { ...MANANA, nombre: "Tarde", horaInicio: "15:00", horaFin: "20:00" });

    await asignarATurno(ctx, m.id, persona.usuarioId);
    await asignarATurno(ctx, t.id, persona.usuarioId);

    const turnos = await turnosDelEstablecimiento(ctx);
    expect(turnos.every((x) => x.personas.length === 1)).toBe(true);
  });

  it("el administrador puede asignarse a sí mismo: en muchos locales atiende la taquilla", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Duenio" });
    const suyo = await crearCuenta(ADMIN, {
      email: "duenio@ejemplo.co",
      nombre: "Dueño",
      passwordTemporal: CLAVE,
      rol: "admin_parqueadero",
      parqueaderoId: p.id,
    });
    const ctx = comoAdminDe(p.id);
    const t = await crearTurno(ctx, MANANA);

    await asignarATurno(ctx, t.id, suyo.usuarioId);
    expect((await turnosDelEstablecimiento(ctx))[0]!.personas).toHaveLength(1);
  });
});

describe("dos establecimientos con organizaciones opuestas conviven (SC-009)", () => {
  it("uno con un solo turno de todo el día y otro con tres", async () => {
    const uno = await crearParqueadero(ADMIN, { nombre: "Parqueadero Simple" });
    const otro = await crearParqueadero(ADMIN, { nombre: "Parqueadero Complejo" });

    await crearTurno(comoAdminDe(uno.id), {
      nombre: "Único",
      horaInicio: "00:00",
      horaFin: "23:59",
      dias: [0, 1, 2, 3, 4, 5, 6],
    });

    for (const [nombre, ini, fin] of [
      ["Mañana", "06:00", "14:00"],
      ["Tarde", "14:00", "22:00"],
      ["Noche", "22:00", "06:00"],
    ] as const) {
      await crearTurno(comoAdminDe(otro.id), {
        nombre,
        horaInicio: ini,
        horaFin: fin,
        dias: [1, 2, 3, 4, 5],
      });
    }

    expect(await turnosDelEstablecimiento(comoAdminDe(uno.id))).toHaveLength(1);
    expect(await turnosDelEstablecimiento(comoAdminDe(otro.id))).toHaveLength(3);
  });
});

describe("el establecimiento suspendido", () => {
  it("rechaza crear turnos y permite consultarlos (SC-005)", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Turno Suspenso" });
    await crearTurno(comoAdminDe(p.id), MANANA);

    await cambiarEstadoParqueadero(ADMIN, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "prueba de modo restringido",
    });

    const suspendido = comoAdminDe(p.id, "suspendido");
    await expect(crearTurno(suspendido, MANANA)).rejects.toThrow(EstablecimientoRestringido);
    expect(await turnosDelEstablecimiento(suspendido)).toHaveLength(1);
  });
});
