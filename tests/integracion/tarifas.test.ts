import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, tarifa, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero } from "@/dominio/parqueaderos/cambiar-estado";
import { declararTarifa, TarifaInvalida } from "@/dominio/tarifas/declarar";
import { aTarifaAplicable } from "@/dominio/tarifas/consultar";
import { calcularImporte } from "@/dominio/tarifas/calcular";
import {
  historialDeTarifa,
  tarifaVigenteEn,
  tiposSinTarifa,
} from "@/dominio/tarifas/consultar";
import { EstablecimientoRestringido } from "@/lib/autorizacion";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/** Historia 1 — el establecimiento declara sus tarifas. */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-tarifas",
  rol: "admin_general",
};

function comoAdminDe(
  parqueaderoId: string,
  estado: EstadoParqueadero = "activo",
): Contexto {
  return {
    tipo: "establecimiento",
    usuarioId: "u-tarifas",
    rol: "admin_parqueadero",
    parqueaderoId,
    estado,
  };
}

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${tarifa}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-tarifas",
      name: "Admin",
      email: "tarifas@ejemplo.co",
    });
  });
}

async function tipos() {
  return comoPlataforma("administracion_plataforma", (tx) =>
    tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)),
  );
}

const CARRO = {
  modelo: "por_minuto" as const,
  alcancePlena: "jornada" as const,
  tarifaPlena: 14_000,
  tarifaMinima: 500,
  valorMinuto: 60,
};

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("declarar una tarifa", () => {
  it("queda vigente y consultable", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Tarifas" });
    const [automovil] = await tipos();

    const creada = await declararTarifa(comoAdminDe(p.id), {
      tipoVehiculoId: automovil!.id,
      ...CARRO,
    });

    expect(creada.vigenteHasta).toBeNull();

    const vigente = await tarifaVigenteEn(comoAdminDe(p.id), automovil!.id, new Date());
    expect(vigente?.id).toBe(creada.id);
    expect(vigente?.valorMinuto).toBe(60);
  });

  it("informa qué tipos de vehículo todavía no tienen tarifa", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Faltantes" });
    const catalogo = await tipos();

    expect(await tiposSinTarifa(comoAdminDe(p.id))).toHaveLength(catalogo.length);

    await declararTarifa(comoAdminDe(p.id), {
      tipoVehiculoId: catalogo[0]!.id,
      ...CARRO,
    });

    const faltan = await tiposSinTarifa(comoAdminDe(p.id));
    expect(faltan).toHaveLength(catalogo.length - 1);
    expect(faltan.map((t) => t.id)).not.toContain(catalogo[0]!.id);
  });
});

describe("el versionado no pierde nada", () => {
  it("modificar cierra la anterior y abre una nueva", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Version" });
    const [automovil] = await tipos();
    const ctx = comoAdminDe(p.id);

    const primera = await declararTarifa(ctx, { tipoVehiculoId: automovil!.id, ...CARRO });
    const segunda = await declararTarifa(ctx, {
      tipoVehiculoId: automovil!.id,
      ...CARRO,
      valorMinuto: 80,
    });

    const historial = await historialDeTarifa(ctx, automovil!.id);

    expect(historial).toHaveLength(2);
    expect(historial[0]!.id).toBe(segunda.id);
    expect(historial[0]!.vigenteHasta).toBeNull();

    const anterior = historial.find((t) => t.id === primera.id)!;
    expect(anterior.vigenteHasta).not.toBeNull();
    expect(anterior.valorMinuto).toBe(60);
  });

  it("cobra con la tarifa que regía en el momento consultado, no con la actual", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Historico" });
    const [automovil] = await tipos();
    const ctx = comoAdminDe(p.id);

    const primera = await declararTarifa(ctx, { tipoVehiculoId: automovil!.id, ...CARRO });
    const momentoIntermedio = new Date();
    await new Promise((r) => setTimeout(r, 20));
    await declararTarifa(ctx, {
      tipoVehiculoId: automovil!.id,
      ...CARRO,
      valorMinuto: 80,
    });

    const regia = await tarifaVigenteEn(ctx, automovil!.id, momentoIntermedio);
    expect(regia?.id).toBe(primera.id);
    expect(regia?.valorMinuto).toBe(60);
  });

  it("nunca deja dos versiones abiertas del mismo tipo", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Unico" });
    const [automovil] = await tipos();
    const ctx = comoAdminDe(p.id);

    await declararTarifa(ctx, { tipoVehiculoId: automovil!.id, ...CARRO });
    await declararTarifa(ctx, { tipoVehiculoId: automovil!.id, ...CARRO, valorMinuto: 70 });

    const abiertas = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`
        select count(*)::int as n from tarifa
         where parqueadero_id = ${p.id}
           and tipo_vehiculo_id = ${automovil!.id}
           and vigente_hasta is null
      `),
    );

    expect((abiertas.rows[0] as { n: number }).n).toBe(1);
  });

  it("la base rechaza una segunda versión abierta insertada por fuera del dominio", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Choque" });
    const [automovil] = await tipos();
    await declararTarifa(comoAdminDe(p.id), { tipoVehiculoId: automovil!.id, ...CARRO });

    // Saltándose `declararTarifa`, que es lo que el índice único debe cubrir.
    await expect(
      comoPlataforma("administracion_plataforma", (tx) =>
        tx.insert(tarifa).values({
          parqueaderoId: p.id,
          tipoVehiculoId: automovil!.id,
          modelo: "por_minuto",
          alcancePlena: "jornada",
          tarifaPlena: 9_000,
          tarifaMinima: 400,
          valorMinuto: 50,
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("validación", () => {
  const casos: [string, Partial<typeof CARRO> & Record<string, unknown>][] = [
    ["mínima mayor que la plena", { tarifaMinima: 20_000 }],
    ["valor por minuto negativo", { valorMinuto: -1 }],
    ["plena negativa", { tarifaPlena: -1 }],
    ["parámetros del otro modelo", { intervaloMinutos: 30, valorIntervalo: 500 }],
  ];

  for (const [nombre, cambio] of casos) {
    it(`rechaza ${nombre}`, async () => {
      const p = await crearParqueadero(ADMIN_GENERAL, { nombre: `P ${nombre}` });
      const [automovil] = await tipos();

      await expect(
        declararTarifa(comoAdminDe(p.id), {
          tipoVehiculoId: automovil!.id,
          ...CARRO,
          ...cambio,
        }),
      ).rejects.toThrow(TarifaInvalida);
    });
  }

  it("rechaza un intervalo de cero minutos", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Intervalo" });
    const tipoBici = (await tipos()).find((t) => t.codigo === "bicicleta")!;

    await expect(
      declararTarifa(comoAdminDe(p.id), {
        tipoVehiculoId: tipoBici.id,
        modelo: "por_intervalo",
        alcancePlena: "jornada",
        tarifaPlena: 4_000,
        intervaloMinutos: 0,
        valorIntervalo: 500,
      }),
    ).rejects.toThrow(TarifaInvalida);
  });
});

describe("el establecimiento suspendido", () => {
  it("rechaza declarar una tarifa y permite consultarla (SC-005)", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Suspendido" });
    const [automovil] = await tipos();
    await declararTarifa(comoAdminDe(p.id), { tipoVehiculoId: automovil!.id, ...CARRO });

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "prueba de modo restringido",
    });

    const suspendido = comoAdminDe(p.id, "suspendido");

    await expect(
      declararTarifa(suspendido, { tipoVehiculoId: automovil!.id, ...CARRO, valorMinuto: 99 }),
    ).rejects.toThrow(EstablecimientoRestringido);

    const vigente = await tarifaVigenteEn(suspendido, automovil!.id, new Date());
    expect(vigente?.valorMinuto).toBe(60);
  });
});

describe("el tercer modelo se guarda y se cobra igual que en el diseño", () => {
  const PRIMERA_HORA = {
    modelo: "primera_hora_y_fraccion" as const,
    alcancePlena: "jornada" as const,
    valorPrimeraHora: 1_400,
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 20_000,
  };

  it("va y vuelve de la base sin perder ningún parámetro", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero Primera Hora" });
    const [automovil] = await tipos();
    const ctx = comoAdminDe(p.id);

    await declararTarifa(ctx, { tipoVehiculoId: automovil!.id, ...PRIMERA_HORA });

    const fila = await tarifaVigenteEn(ctx, automovil!.id, new Date());
    expect(fila?.modelo).toBe("primera_hora_y_fraccion");
    expect(fila?.valorPrimeraHora).toBe(1_400);
    expect(fila?.intervaloMinutos).toBe(15);
    expect(fila?.valorIntervalo).toBe(700);

    // El caso de la pantalla 1b: 10:32 → 16:15 son 343 minutos y da $14.700.
    const cobro = calcularImporte({
      entrada: new Date("2026-08-17T10:32:00-05:00"),
      salida: new Date("2026-08-17T16:15:00-05:00"),
      tarifa: aTarifaAplicable(fila!),
      horario: { abierto24h: true, franjas: [], cobraHorasCerradas: false },
    });
    expect(cobro.importe).toBe(14_700);
  });

  it("rechaza una tarifa de primera hora sin su precio", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero PH Incompleta" });
    const [automovil] = await tipos();

    await expect(
      declararTarifa(comoAdminDe(p.id), {
        tipoVehiculoId: automovil!.id,
        ...PRIMERA_HORA,
        valorPrimeraHora: null,
      }),
    ).rejects.toThrow(TarifaInvalida);
  });

  it("la base rechaza mezclar sus columnas con las del modelo por minuto", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero PH Mezcla" });
    const [automovil] = await tipos();

    // Saltándose la validación del dominio: es lo que el CHECK debe cubrir.
    await expect(
      comoPlataforma("administracion_plataforma", (tx) =>
        tx.insert(tarifa).values({
          parqueaderoId: p.id,
          tipoVehiculoId: automovil!.id,
          modelo: "primera_hora_y_fraccion",
          alcancePlena: "jornada",
          tarifaPlena: 20_000,
          valorPrimeraHora: 1_400,
          intervaloMinutos: 15,
          valorIntervalo: 700,
          valorMinuto: 60,
        }),
      ),
    ).rejects.toThrow();
  });
});
