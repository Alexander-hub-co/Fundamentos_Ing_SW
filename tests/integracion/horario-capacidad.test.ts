import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { declararHorario, HorarioInvalido } from "@/dominio/horarios/declarar";
import { horarioDelCobro, estaAbierto } from "@/dominio/horarios/consultar";
import { capacidadDeclarada, CapacidadInvalida, declararCapacidad } from "@/dominio/capacidad/declarar";
import { EstablecimientoRestringido } from "@/lib/autorizacion";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/** Historia 2 — cuándo abre y cuánto cabe. */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-hc", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-hc",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado,
});

const franjas = (dias: number[], apertura: string, cierre: string) =>
  dias.map((diaSemana) => ({ diaSemana, horaApertura: apertura, horaCierre: cierre }));

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from horario_franja`);
    await tx.execute(sql`delete from horario_atencion`);
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-hc", name: "Admin", email: "hc@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("declarar el horario", () => {
  it("queda guardado y el sistema responde si está abierto", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Horario" });
    const ctx = comoAdminDe(p.id);

    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: franjas([1, 2, 3, 4, 5], "07:00", "19:00"),
    });

    const h = await horarioDelCobro(ctx);
    expect(h.abierto24h).toBe(false);
    expect(h.franjas).toHaveLength(5);
    expect(estaAbierto(h, new Date("2026-08-17T10:00:00-05:00"))).toBe(true);
    expect(estaAbierto(h, new Date("2026-08-16T10:00:00-05:00"))).toBe(false);
  });

  it("reemplaza el anterior entero en vez de acumular franjas", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Reemplazo" });
    const ctx = comoAdminDe(p.id);

    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: franjas([1, 2, 3, 4, 5], "07:00", "19:00"),
    });
    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: true,
      franjas: franjas([6], "08:00", "14:00"),
    });

    const h = await horarioDelCobro(ctx);
    expect(h.franjas).toHaveLength(1);
    expect(h.cobraHorasCerradas).toBe(true);
  });

  it("pasar a 24 horas borra las franjas", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero 24h" });
    const ctx = comoAdminDe(p.id);

    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: franjas([1], "07:00", "19:00"),
    });
    await declararHorario(ctx, { abierto24h: true, cobraHorasCerradas: false, franjas: [] });

    const h = await horarioDelCobro(ctx);
    expect(h.abierto24h).toBe(true);
    expect(h.franjas).toEqual([]);
  });

  it("un establecimiento sin horario se trata como abierto siempre", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Sin Horario" });
    const h = await horarioDelCobro(comoAdminDe(p.id));
    expect(h.abierto24h).toBe(true);
  });
});

describe("validación del horario", () => {
  it("rechaza hora de cierre igual a la de apertura", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Igual" });
    await expect(
      declararHorario(comoAdminDe(p.id), {
        abierto24h: false,
        cobraHorasCerradas: false,
        franjas: franjas([1], "07:00", "07:00"),
      }),
    ).rejects.toThrow(HorarioInvalido);
  });

  it("rechaza dos franjas solapadas el mismo día", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Solape" });
    await expect(
      declararHorario(comoAdminDe(p.id), {
        abierto24h: false,
        cobraHorasCerradas: false,
        franjas: [
          { diaSemana: 1, horaApertura: "07:00", horaCierre: "13:00" },
          { diaSemana: 1, horaApertura: "12:00", horaCierre: "19:00" },
        ],
      }),
    ).rejects.toThrow(HorarioInvalido);
  });

  it("acepta dos franjas del mismo día que no se solapan", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Partido" });
    await declararHorario(comoAdminDe(p.id), {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: [
        { diaSemana: 1, horaApertura: "07:00", horaCierre: "12:00" },
        { diaSemana: 1, horaApertura: "14:00", horaCierre: "19:00" },
      ],
    });

    expect((await horarioDelCobro(comoAdminDe(p.id))).franjas).toHaveLength(2);
  });

  it("rechaza quedarse sin franjas si no es de 24 horas", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Vacio" });
    await expect(
      declararHorario(comoAdminDe(p.id), {
        abierto24h: false,
        cobraHorasCerradas: false,
        franjas: [],
      }),
    ).rejects.toThrow(HorarioInvalido);
  });
});

describe("capacidad", () => {
  async function unTipo() {
    const [t] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)).limit(1),
    );
    return t!;
  }

  it("se declara y se consulta", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Cupos" });
    const tipo = await unTipo();

    await declararCapacidad(comoAdminDe(p.id), tipo.id, 40);
    const declarada = await capacidadDeclarada(comoAdminDe(p.id));

    expect(declarada).toHaveLength(1);
    expect(declarada[0]!.capacidad.cupos).toBe(40);
  });

  it("declarar otra vez reemplaza en vez de duplicar", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Recupos" });
    const tipo = await unTipo();

    await declararCapacidad(comoAdminDe(p.id), tipo.id, 40);
    await declararCapacidad(comoAdminDe(p.id), tipo.id, 55);

    const declarada = await capacidadDeclarada(comoAdminDe(p.id));
    expect(declarada).toHaveLength(1);
    expect(declarada[0]!.capacidad.cupos).toBe(55);
  });

  it("rechaza cupos negativos", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Negativo" });
    const tipo = await unTipo();
    await expect(declararCapacidad(comoAdminDe(p.id), tipo.id, -1)).rejects.toThrow(
      CapacidadInvalida,
    );
  });
});

describe("el establecimiento suspendido", () => {
  it("rechaza modificar horario y capacidad, y permite consultarlos (SC-005)", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Suspenso" });
    const ctx = comoAdminDe(p.id);
    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: franjas([1], "07:00", "19:00"),
    });

    await cambiarEstadoParqueadero(ADMIN, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "prueba de modo restringido",
    });

    const suspendido = comoAdminDe(p.id, "suspendido");

    await expect(
      declararHorario(suspendido, { abierto24h: true, cobraHorasCerradas: false, franjas: [] }),
    ).rejects.toThrow(EstablecimientoRestringido);

    expect((await horarioDelCobro(suspendido)).franjas).toHaveLength(1);
  });
});
