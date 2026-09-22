import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import {
  delegacionesVigentes,
  emitirCorreccion,
  otorgarDelegacion,
} from "@/dominio/correcciones/emitir";
import { NoAutorizado } from "@/lib/autorizacion";
import {
  registrarEntrada,
  registrarSalida,
} from "@/dominio/taquilla/registrar";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero } from "@/db/esquema";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * La tercera regla de la enmienda: una delegación NO alcanza fuera del
 * establecimiento de quien la otorga.
 *
 * Es la que impide que el permiso delegable se convierta en un rodeo al
 * Principio I. Sin ella, un administrador podría autorizar a alguien a corregir
 * cobros de otro parqueadero, que es exactamente lo que la constitución llama
 * el único fallo sin reparación posible.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-deleg", rol: "admin_general" };

const comoOperario = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-deleg",
  rol: "operario",
  parqueaderoId,
  estado,
});
const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-deleg",
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
    await tx.insert(usuario).values([
      { id: "u-deleg", name: "Operario", email: "deleg@ejemplo.co" },
      // Alguien a quien delegarle el permiso, que no sea uno mismo.
      { id: "u-otro", name: "Otra Persona", email: "otra@ejemplo.co" },
    ]);
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

describe("una delegación no cruza la frontera", () => {
  it("la otorgada en B no sirve para corregir en A", async () => {
    const b = await conTarifas();
    const a = await conTarifas();

    await otorgarDelegacion(comoAdminDe(b.parqueaderoId), "u-otro", "emitir_correccion");

    // El movimiento cobrado vive en A.
    const ctxA = comoOperario(a.parqueaderoId);
    const abierto = await registrarEntrada(ctxA, "ABC123", ENTRADA);
    const mov = await registrarSalida(ctxA, abierto.id, SALIDA);

    // Y la persona llega con el contexto de A, sin la delegación: el ámbito de
    // la sesión sólo trae las delegaciones de SU establecimiento.
    await expect(
      emitirCorreccion(
        { tipo: "establecimiento", usuarioId: "u-otro", rol: "operario", parqueaderoId: a.parqueaderoId, estado: "activo" },
        mov.id,
        1_000,
        "Motivo",
      ),
    ).rejects.toThrow(NoAutorizado);
  });

  it("A no ve las delegaciones de B", async () => {
    const b = await conTarifas();
    await otorgarDelegacion(comoAdminDe(b.parqueaderoId), "u-otro", "emitir_correccion");

    const a = await conTarifas();
    expect((await delegacionesVigentes(comoAdminDe(a.parqueaderoId))).size).toBe(0);
    expect((await delegacionesVigentes(comoAdminDe(b.parqueaderoId))).size).toBe(1);
  });

  it("A no puede escribir una delegación en el ámbito de B", async () => {
    const b = await conTarifas();
    const a = await conTarifas();

    await expect(
      conAmbito(a.parqueaderoId, (tx) =>
        tx.execute(sql`
          insert into delegacion (parqueadero_id, usuario_id, operacion, otorgada_por)
          values (${b.parqueaderoId}, 'u-otro', 'emitir_correccion', 'u-deleg')
        `),
      ),
    ).rejects.toThrow();
  });

  it("aun con la delegación puesta a mano, corregir en B desde A no alcanza el movimiento", async () => {
    // Doble cinturón: aunque alguien lograra fabricar el contexto, la política
    // de ámbito de los movimientos sigue en pie.
    const b = await conTarifas();
    const ctxB = comoOperario(b.parqueaderoId);
    const abierto = await registrarEntrada(ctxB, "ABC123", ENTRADA);
    const mov = await registrarSalida(ctxB, abierto.id, SALIDA);

    const a = await conTarifas();
    await expect(
      emitirCorreccion(
        {
          tipo: "establecimiento",
          usuarioId: "u-otro",
          rol: "operario",
          parqueaderoId: a.parqueaderoId,
          estado: "activo",
          delegaciones: ["emitir_correccion"],
        },
        mov.id,
        1_000,
        "Motivo",
      ),
    ).rejects.toThrow();
  });
});
