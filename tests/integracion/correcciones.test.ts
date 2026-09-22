import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { movimiento, parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import {
  correccionesDe,
  CorreccionInvalida,
  delegacionesVigentes,
  emitirCorreccion,
  otorgarDelegacion,
  revocarDelegacion,
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
 * Corregir un cobro, y el permiso delegable que lo hace posible.
 *
 * La constitución pasó a 1.1.0 por esta funcionalidad: un permiso que un
 * administrador otorga a una persona concreta no cabía en "exactamente tres
 * niveles". Se enmendó por el procedimiento formal y la enmienda lo acota con
 * cuatro reglas; estas pruebas comprueban las cuatro.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-corr", rol: "admin_general" };

const comoOperario = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-corr",
  rol: "operario",
  parqueaderoId,
  estado,
});
/**
 * Un operario a quien el administrador YA le delegó el permiso de corregir.
 *
 * Es OTRA persona, no la misma que administra: delegarse un permiso a uno mismo
 * no significa nada, y el dominio lo rechaza.
 */
const comoOperarioDelegado = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-otro",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
  delegaciones: ["emitir_correccion"],
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-corr",
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
      { id: "u-corr", name: "Operario", email: "corr@ejemplo.co" },
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

/** Un movimiento ya cobrado, listo para corregir. */
async function cobrado(parqueaderoId: string) {
  const ctx = comoOperario(parqueaderoId);
  const abierto = await registrarEntrada(ctx, "ABC123", ENTRADA);
  return registrarSalida(ctx, abierto.id, SALIDA);
}

describe("la corrección conserva los dos importes", () => {
  it("el original sigue en el movimiento y el corregido en el asiento", async () => {
    // Reemplazar uno por otro destruiría la única prueba de que hubo un error.
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);
    const admin = comoAdminDe(parqueaderoId);

    await emitirCorreccion(admin, mov.id, 9_000, "Se cobró de más por hora mal leída");

    const [asiento] = await correccionesDe(admin, mov.id);
    expect(mov.importe).toBe(14_000);
    expect(asiento!.importeCorregido).toBe(9_000);
    expect(asiento!.motivo).toMatch(/hora mal leída/);
    expect(asiento!.emitidaPor).toBe("u-corr");
  });

  it("el movimiento original no se toca", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    await emitirCorreccion(comoAdminDe(parqueaderoId), mov.id, 9_000, "Corrección");

    const [releido] = await conAmbito(parqueaderoId, (tx) =>
      tx.select().from(movimiento).where(eq(movimiento.id, mov.id)),
    );
    expect(releido!.importe).toBe(14_000);
  });

  it("sin motivo no se emite", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    await expect(
      emitirCorreccion(comoAdminDe(parqueaderoId), mov.id, 9_000, "   "),
    ).rejects.toThrow(CorreccionInvalida);
  });

  it("corregir al mismo importe no es corregir", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    await expect(
      emitirCorreccion(comoAdminDe(parqueaderoId), mov.id, 14_000, "Igual"),
    ).rejects.toThrow(/nada que corregir/);
  });

  it("un movimiento abierto no se corrige: todavía no se cobró nada", async () => {
    const { parqueaderoId } = await conTarifas();
    const abierto = await registrarEntrada(comoOperario(parqueaderoId), "XYZ456", ENTRADA);

    await expect(
      emitirCorreccion(comoAdminDe(parqueaderoId), abierto.id, 100, "Motivo"),
    ).rejects.toThrow();
  });
});

describe("quién puede corregir", () => {
  it("el administrador, por su rol", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    await expect(
      emitirCorreccion(comoAdminDe(parqueaderoId), mov.id, 9_000, "Motivo"),
    ).resolves.toBeDefined();
  });

  it("un operario NO, aunque haya sido él quien cobró mal", async () => {
    // Quien cobró de menos no debe poder ajustar su propia caja sin que nadie
    // lo haya autorizado.
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    await expect(
      emitirCorreccion(comoOperario(parqueaderoId), mov.id, 9_000, "Motivo"),
    ).rejects.toThrow(NoAutorizado);
  });

  it("un operario CON delegación vigente sí", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    await expect(
      emitirCorreccion(comoOperarioDelegado(parqueaderoId), mov.id, 9_000, "Motivo"),
    ).resolves.toBeDefined();
  });
});

describe("la delegación", () => {
  it("se otorga y queda visible con quién la dio", async () => {
    const { parqueaderoId } = await conTarifas();
    const admin = comoAdminDe(parqueaderoId);

    await otorgarDelegacion(admin, "u-otro", "emitir_correccion");

    const vigentes = await delegacionesVigentes(admin);
    expect(vigentes.get("u-otro")).toEqual(["emitir_correccion"]);
  });

  it("otorgarla dos veces no crea dos: es la misma autorización", async () => {
    const { parqueaderoId } = await conTarifas();
    const admin = comoAdminDe(parqueaderoId);

    await otorgarDelegacion(admin, "u-otro", "emitir_correccion");
    await otorgarDelegacion(admin, "u-otro", "emitir_correccion");

    expect((await delegacionesVigentes(admin)).get("u-otro")).toHaveLength(1);
  });

  it("un operario no puede otorgarse permisos a sí mismo ni a nadie", async () => {
    // Sería la escalada de privilegios que la enmienda existe para evitar.
    const { parqueaderoId } = await conTarifas();

    await expect(
      otorgarDelegacion(comoOperario(parqueaderoId), "u-otro", "emitir_correccion"),
    ).rejects.toThrow(NoAutorizado);
  });

  it("ni siquiera un operario que YA tiene la delegación de corregir", async () => {
    // La delegación concede exactamente una operación, no la capacidad de
    // repartirla. Ningún rol puede delegar algo que él mismo no puede hacer.
    const { parqueaderoId } = await conTarifas();

    await expect(
      otorgarDelegacion(comoOperarioDelegado(parqueaderoId), "u-otro", "emitir_correccion"),
    ).rejects.toThrow(NoAutorizado);
  });

  it("revocarla la quita, y las correcciones ya emitidas se conservan", async () => {
    const { parqueaderoId } = await conTarifas();
    const admin = comoAdminDe(parqueaderoId);
    const mov = await cobrado(parqueaderoId);

    await otorgarDelegacion(admin, "u-otro", "emitir_correccion");
    const emitida = await emitirCorreccion(
      comoOperarioDelegado(parqueaderoId),
      mov.id,
      9_000,
      "Antes de revocar",
    );

    await revocarDelegacion(admin, "u-otro", "emitir_correccion");

    expect((await delegacionesVigentes(admin)).get("u-otro")).toBeUndefined();
    // Era válida cuando se hizo.
    const asientos = await correccionesDe(admin, mov.id);
    expect(asientos.map((a) => a.id)).toContain(emitida.id);
  });

  it("revocada, el contexto sin delegación ya no puede corregir", async () => {
    const { parqueaderoId } = await conTarifas();
    const mov = await cobrado(parqueaderoId);

    // Sin delegaciones en el contexto: es lo que devolvería la sesión tras
    // revocar.
    await expect(
      emitirCorreccion(comoOperario(parqueaderoId), mov.id, 9_000, "Motivo"),
    ).rejects.toThrow(NoAutorizado);
  });
});
