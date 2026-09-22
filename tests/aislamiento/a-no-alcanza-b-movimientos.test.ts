import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { movimiento, parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import {
  registrarCortesia,
  registrarEntrada,
  registrarSalida,
} from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero } from "@/db/esquema";
import { RecursoNoAlcanzable } from "@/lib/errores";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Prueba negativa del Principio I sobre los movimientos.
 *
 * Son el dato más sensible del sistema: quién estuvo dónde, cuánto tiempo y
 * cuánto pagó. Un escape acá le entregaría a un parqueadero la operación
 * completa de otro, que es el único fallo que la constitución describe como sin
 * reparación posible.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-aisl-mov", rol: "admin_general" };

const comoOperario = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-mov",
  rol: "operario",
  parqueaderoId,
  estado,
});
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-aisl-mov",
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
    await tx.insert(usuario).values({ id: "u-aisl-mov", name: "Operario", email: "aisl-mov@ejemplo.co" });
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

describe("A no alcanza los movimientos de B", () => {
  it("no los ve en su listado", async () => {
    const b = await conTarifas();
    await registrarEntrada(comoOperario(b.parqueaderoId), "ABC123", ENTRADA);

    const a = await conTarifas();
    const desdeA = await conAmbito(a.parqueaderoId, (tx) => tx.select().from(movimiento));

    expect(desdeA).toHaveLength(0);
  });

  it("tampoco yendo directo al identificador", async () => {
    const b = await conTarifas();
    const suyo = await registrarEntrada(comoOperario(b.parqueaderoId), "ABC123", ENTRADA);

    const a = await conTarifas();
    const desdeA = await conAmbito(a.parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(eq(movimiento.id, suyo.id)),
    );

    expect(desdeA).toHaveLength(0);
  });

  it("A no puede cerrar un movimiento de B", async () => {
    const b = await conTarifas();
    const suyo = await registrarEntrada(comoOperario(b.parqueaderoId), "ABC123", ENTRADA);

    const a = await conTarifas();
    await expect(
      registrarSalida(comoOperario(a.parqueaderoId), suyo.id, SALIDA),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("A no puede darle una cortesía a un vehículo de B", async () => {
    const b = await conTarifas();
    const suyo = await registrarEntrada(comoOperario(b.parqueaderoId), "ABC123", ENTRADA);

    const a = await conTarifas();
    await expect(
      registrarCortesia(comoOperario(a.parqueaderoId), suyo.id, "Cortesía ajena", SALIDA),
    ).rejects.toThrow(RecursoNoAlcanzable);
  });

  it("A no puede escribir un movimiento en el ámbito de B", async () => {
    const b = await conTarifas();
    const a = await conTarifas();

    await expect(
      conAmbito(a.parqueaderoId, (tx) =>
        tx.insert(movimiento).values({
          parqueaderoId: b.parqueaderoId,
          codigo: "XXX-000001",
          placa: "HAK123",
          tipoVehiculoId: b.autoId,
          operarioEntrada: "u-aisl-mov",
        }),
      ),
    ).rejects.toThrow();
  });

  it("la misma placa puede estar adentro en A y en B a la vez", async () => {
    // La unicidad es POR ESTABLECIMIENTO, no global. Dos parqueaderos distintos
    // pueden tener el mismo carro registrado —no a la vez físicamente, pero el
    // sistema no puede suponer nada sobre eso— y bloquearlo sería filtrar
    // información de uno al otro.
    const a = await conTarifas();
    const b = await conTarifas();

    await registrarEntrada(comoOperario(a.parqueaderoId), "ABC123", ENTRADA);
    const enB = await registrarEntrada(comoOperario(b.parqueaderoId), "ABC123", ENTRADA);

    expect(enB.placa).toBe("ABC123");
  });
});

describe("el intento queda registrado", () => {
  it("anota el recurso y el ámbito desde el que se intentó", async () => {
    const b = await conTarifas();
    const suyo = await registrarEntrada(comoOperario(b.parqueaderoId), "ABC123", ENTRADA);

    const a = await conTarifas();
    await registrarSalida(comoOperario(a.parqueaderoId), suyo.id, SALIDA).catch(() => {});

    const asientos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`select recurso, parqueadero_ambito from acceso_denegado`),
    );

    expect(asientos.rows).toContainEqual({
      recurso: `movimiento:${suyo.id}`,
      parqueadero_ambito: a.parqueaderoId,
    });
  });
});
