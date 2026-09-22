import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { movimiento, parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { resolverPlaca } from "@/dominio/taquilla/resolver";
import {
  registrarEntrada,
  registrarSalida,
  TaquillaInvalida,
} from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero } from "@/db/esquema";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Las dos garantías que no se pueden ablandar.
 *
 * Una placa adentro dos veces y un movimiento cerrado editable son los dos
 * fallos que este sistema no debe poder tener, y las dos se prueban contra el
 * MOTOR y no contra la interfaz. Una garantía que sólo vive en el código de la
 * aplicación se pierde en cuanto alguien escriba la próxima consulta sin
 * acordarse.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-conc", rol: "admin_general" };

const comoOperario = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-conc",
  rol: "operario",
  parqueaderoId,
  estado,
});
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-conc",
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
    await tx.insert(usuario).values({ id: "u-conc", name: "Operario", email: "conc@ejemplo.co" });
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

/**
 * El mensaje de verdad, no el envoltorio.
 *
 * Drizzle envuelve los errores del motor y deja "Failed query: ..." en el
 * nivel de arriba; lo que dijo PostgreSQL viaja en `cause`, a veces más abajo.
 * Recorrer la cadena es lo mismo que hace el dominio para traducir las
 * violaciones de unicidad a mensajes legibles.
 */
function razonDe(error: unknown): string {
  const partes: string[] = [];
  let actual: unknown = error;
  for (let salto = 0; salto < 6 && actual instanceof Error; salto++) {
    partes.push(actual.message);
    actual = (actual as { cause?: unknown }).cause;
  }
  return partes.join(" | ");
}

describe("una placa no está adentro dos veces", () => {
  it("ni siquiera con dos registros SIMULTÁNEOS", async () => {
    // En secuencia, cualquier implementación pasa: la segunda consulta ve a la
    // primera. Lanzarlas en paralelo es lo que prueba de verdad la garantía,
    // porque las dos leen el mismo estado antes de escribir.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const resultados = await Promise.allSettled([
      registrarEntrada(ctx, "ABC123", ENTRADA),
      registrarEntrada(ctx, "abc-123", ENTRADA),
    ]);

    const bien = resultados.filter((r) => r.status === "fulfilled");
    const mal = resultados.filter((r) => r.status === "rejected");

    expect(bien).toHaveLength(1);
    expect(mal).toHaveLength(1);
  });

  it("y el que pierde recibe un mensaje legible, no un error del motor", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    await registrarEntrada(ctx, "ABC123", ENTRADA);

    const error = await registrarEntrada(ctx, "ABC123", ENTRADA).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TaquillaInvalida);
    expect((error as Error).message).toMatch(/ya está adentro/);
    // Con un carro esperando, "duplicate key value violates unique constraint"
    // no le sirve a nadie.
    expect((error as Error).message).not.toMatch(/constraint|duplicate|violates/i);
  });

  it("diez intentos a la vez dejan uno solo adentro", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () => registrarEntrada(ctx, "ZZZ999", ENTRADA)),
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const adentro = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(eq(movimiento.placa, "ZZZ999")),
    );
    expect(adentro).toHaveLength(1);
  });
});

describe("un movimiento cerrado es inmutable", () => {
  it("no se puede modificar con una CONSULTA DIRECTA, no sólo desde la interfaz", async () => {
    // Ésta es la prueba que hace que el Principio IV sea una garantía y no una
    // intención. Si la protección viviera únicamente en el dominio, este
    // `update` pasaría y el histórico sería editable por cualquiera que escriba
    // una consulta.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    const error = await conAmbito(parqueaderoId, (tx) =>
      tx.update(movimiento).set({ importe: 1 }).where(eq(movimiento.id, cerrado.id)),
    ).catch((e: unknown) => e);

    expect(razonDe(error)).toMatch(/no se modifica/);
  });

  it("tampoco se puede borrar", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    const error = await conAmbito(parqueaderoId, (tx) =>
      tx.delete(movimiento).where(eq(movimiento.id, cerrado.id)),
    ).catch((e: unknown) => e);

    expect(razonDe(error)).toMatch(/no se elimina/);
  });

  it("ni desde la puerta privilegiada de plataforma", async () => {
    // `comoPlataforma` tiene BYPASSRLS y aun así queda atada: la exención del
    // disparador alcanza sólo al rol dueño, que ninguna ruta de la aplicación
    // usa.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    const error = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.update(movimiento).set({ importe: 1 }).where(eq(movimiento.id, cerrado.id)),
    ).catch((e: unknown) => e);

    expect(razonDe(error)).toMatch(/no se modifica/);
  });

  it("un movimiento ABIERTO sí se puede escribir: todavía no es historial", async () => {
    const { parqueaderoId } = await conTarifas();
    const abierto = await registrarEntrada(comoOperario(parqueaderoId), "ABC123", ENTRADA);

    // Es lo que hace `registrarSalida`: pasar de abierto a cerrado.
    await expect(
      conAmbito(parqueaderoId, (tx) =>
        tx.update(movimiento).set({ placa: "ABC124" }).where(eq(movimiento.id, abierto.id)),
      ),
    ).resolves.toBeDefined();
  });

  it("marcar el comprobante como emitido SÍ se permite sobre uno cerrado", async () => {
    // Es la única excepción, y tiene que existir: la impresión ocurre después
    // de cerrar y no toca ni el dinero, ni las horas, ni quién atendió.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    await expect(
      conAmbito(parqueaderoId, (tx) =>
        tx
          .update(movimiento)
          .set({ comprobante: "emitido" })
          .where(eq(movimiento.id, cerrado.id)),
      ),
    ).resolves.toBeDefined();
  });
});

describe("el cobro coincide con el motor ya probado", () => {
  it("la taquilla no reimplementa el cálculo: da lo mismo que el comprobador", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);

    const propuesto = await resolverPlaca(ctx, "ABC123", SALIDA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    // Lo que se le mostró a quien atiende y lo que se cobró tienen que ser el
    // mismo número. Si difirieran, el operario habría dicho un precio y el
    // sistema habría cobrado otro.
    expect(propuesto.tipo === "salida" && propuesto.cobro.importe).toBe(cerrado.importe);
  });
});

describe("el cobro queda congelado", () => {
  it("cambiar la tarifa después no altera lo que ya se cobró", async () => {
    const { parqueaderoId, autoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cerrado = await registrarSalida(ctx, abierto.id, SALIDA);

    const antes = cerrado.importe;
    const desglose = JSON.stringify(cerrado.cobro);

    // Se triplica la tarifa.
    await declararTarifa(comoAdminDe(parqueaderoId), {
      tipoVehiculoId: autoId,
      modelo: "por_intervalo",
      intervaloMinutos: 15,
      valorIntervalo: 2_100,
      tarifaPlena: 54_000,
      alcancePlena: "jornada",
    });

    const [releido] = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(eq(movimiento.id, cerrado.id)),
    );

    expect(releido!.importe).toBe(antes);
    expect(JSON.stringify(releido!.cobro)).toBe(desglose);
  });
});
