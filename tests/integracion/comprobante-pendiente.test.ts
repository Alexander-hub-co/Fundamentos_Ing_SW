import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { registrarCortesia, registrarEntrada, registrarSalida } from "@/dominio/taquilla/registrar";
import {
  comprobanteDe,
  ComprobanteNoDisponible,
  marcarComprobanteEmitido,
  movimientosSinComprobante,
} from "@/dominio/taquilla/comprobante";
import { comprobanteHtml } from "@/app/(establecimiento)/taquilla/comprobante-html";
import type { Contexto } from "@/lib/sesion";
import { limpiarMovimientos } from "../ayuda/limpiar-movimientos";

/**
 * Fase 6 — el comprobante.
 *
 * Lo que se protege acá es una sola regla, y es la que decide si el sistema
 * sirve el día que la impresora falle: **un fallo de impresión no puede
 * deshacer un movimiento**. El carro entró de verdad. Quedarse sin ticket es un
 * problema; perder el registro de que entró es otro mucho peor.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-comp", rol: "admin_general" };

const comoOperario = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-comp",
  rol: "operario",
  parqueaderoId,
  estado: "activo",
});

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-comp",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

const BASE = (() => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d;
})();
const ENTRADA = new Date(BASE);
const SALIDA = new Date(BASE.getTime() + 3 * 60 * 60 * 1000);

async function limpiar() {
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
    await tx.execute(sql`delete from preferencia_usuario`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({
      id: "u-comp",
      name: "Operario",
      email: "comp@ejemplo.co",
      codigo: "OP-04",
    });
  });
}

async function conTarifas() {
  const p = await crearParqueadero(ADMIN, {
    nombre: "Parqueadero Centro Andino",
    direccion: "Carrera 11 #82-71",
    ciudad: "Bogotá",
  });

  const tipos = await conAmbito(p.id, (tx) => tx.select().from(tipoVehiculo));
  const auto = tipos.find((t) => t.codigo === "automovil")!;

  await declararTarifa(comoAdminDe(p.id), {
    tipoVehiculoId: auto.id,
    modelo: "por_intervalo",
    intervaloMinutos: 15,
    valorIntervalo: 700,
    tarifaPlena: 18_000,
    alcancePlena: "jornada",
  });

  return { parqueaderoId: p.id, autoId: auto.id };
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("el ticket que no salió no se pierde", () => {
  it("un movimiento nace con el comprobante pendiente y aparece en la lista", async () => {
    // ES la garantía: registrar NO depende de imprimir. Si dependiera, una
    // impresora sin papel dejaría entrar carros sin registro.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    expect(mov.comprobante).toBe("pendiente");

    const pendientes = await movimientosSinComprobante(ctx);
    expect(pendientes.map((p) => p.id)).toContain(mov.id);
  });

  it("marcarlo emitido lo saca de la lista", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await marcarComprobanteEmitido(ctx, mov.id);

    const pendientes = await movimientosSinComprobante(ctx);
    expect(pendientes.map((p) => p.id)).not.toContain(mov.id);
  });

  it("cobrar vuelve a dejar el comprobante pendiente: son dos papeles distintos", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await marcarComprobanteEmitido(ctx, mov.id);
    await registrarSalida(ctx, mov.id, SALIDA);

    // El ticket de entrada ya salió, pero el recibo del cobro todavía no.
    const pendientes = await movimientosSinComprobante(ctx);
    expect(pendientes.map((p) => p.id)).toContain(mov.id);
  });

  it("los más viejos van primero", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const primero = await registrarEntrada(ctx, "AAA111", ENTRADA);
    const segundo = await registrarEntrada(
      ctx,
      "BBB222",
      new Date(ENTRADA.getTime() + 60 * 60 * 1000),
    );

    const pendientes = await movimientosSinComprobante(ctx);
    expect(pendientes[0]?.id).toBe(primero.id);
    expect(pendientes[1]?.id).toBe(segundo.id);
  });
});

describe("lo que dice el papel", () => {
  it("el de entrada lleva placa, código y establecimiento", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const c = await comprobanteDe(ctx, mov.id);

    expect(c.tipo).toBe("entrada");
    expect(c.placa).toBe("ABC123");
    expect(c.codigo).toBe(mov.codigo);
    expect(c.establecimiento.nombre).toBe("Parqueadero Centro Andino");
    expect(c.atendio).toBe("OP-04");
    expect(c.reimpresion).toBe(false);
    expect(c.importe).toBeNull();
  });

  it("el del cobro lleva el importe que se cobró, no uno recalculado", async () => {
    // Recalcular al imprimir es la trampa evidente: el papel diría otra cosa
    // que la caja si algo cambió en el medio. Se lee lo guardado.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cobrado = await registrarSalida(ctx, mov.id, SALIDA);

    const c = await comprobanteDe(ctx, mov.id);
    expect(c.tipo).toBe("salida");
    expect(c.importe).toBe(cobrado.importe);
    expect(c.minutosDentro).toBe(180);
  });

  it("una cortesía dice en el papel por qué no se cobró", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoAdminDe(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await registrarCortesia(ctx, mov.id, "El cliente es del local de al lado", SALIDA);

    const c = await comprobanteDe(ctx, mov.id);
    expect(c.cortesia?.motivo).toBe("El cliente es del local de al lado");
    expect(comprobanteHtml(c)).toContain("SIN COBRO");
  });

  it("reimprimir avisa que es reimpresión, y dice lo mismo", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const primera = await comprobanteDe(ctx, mov.id);
    await marcarComprobanteEmitido(ctx, mov.id);
    const segunda = await comprobanteDe(ctx, mov.id);

    expect(primera.reimpresion).toBe(false);
    expect(segunda.reimpresion).toBe(true);
    // Lo que importa: el contenido no cambió. Un ticket reimpreso que dijera
    // otra cosa que el original sería peor que no poder reimprimirlo.
    expect(segunda.placa).toBe(primera.placa);
    expect(segunda.codigo).toBe(primera.codigo);
    expect(segunda.importe).toBe(primera.importe);
    expect(comprobanteHtml(segunda)).toContain("REIMPRESIÓN");
    expect(comprobanteHtml(primera)).not.toContain("REIMPRESIÓN");
  });

  it("un movimiento de otro establecimiento no se puede imprimir", async () => {
    const propio = await conTarifas();
    const ajeno = await conTarifas();

    const mov = await registrarEntrada(comoOperario(ajeno.parqueaderoId), "XYZ789", ENTRADA);

    await expect(comprobanteDe(comoOperario(propio.parqueaderoId), mov.id)).rejects.toThrow(
      ComprobanteNoDisponible,
    );
  });
});

describe("la marca al pie", () => {
  it("aparece en el ticket de entrada y en el de salida, en los dos", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const entrada = comprobanteHtml(await comprobanteDe(ctx, mov.id));

    await registrarSalida(ctx, mov.id, SALIDA);
    const salida = comprobanteHtml(await comprobanteDe(ctx, mov.id));

    for (const papel of [entrada, salida]) {
      expect(papel).toContain("CQS");
      expect(papel).toContain("Cristian Quevedo");
      expect(papel).toContain("cqs.labs@gmail.com");
      expect(papel).toContain("+57 320 902 1312");
    }
  });
});

describe("el recibo de salida", () => {
  it("dice cuánto pagó y cuánto estuvo, en palabras del cliente", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const cobrado = await registrarSalida(ctx, mov.id, SALIDA);

    const papel = comprobanteHtml(await comprobanteDe(ctx, mov.id));

    expect(papel).toContain("TOTAL PAGADO");
    expect(papel).toContain(`$${(cobrado.importe ?? 0).toLocaleString("es-CO")}`);
    // Tres horas adentro.
    expect(papel).toContain("Estuvo 3h00 en el parqueadero");
  });

  it("el de entrada NO habla de permanencia ni de total: todavía no hay", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const papel = comprobanteHtml(await comprobanteDe(ctx, mov.id));

    expect(papel).not.toContain("TOTAL PAGADO");
    expect(papel).toContain("Conserve este comprobante");
  });
});

describe("el documento que se manda a la impresora", () => {
  it("lleva la marca que autoriza a imprimirlo", async () => {
    // El navegador sólo manda a la impresora un documento que lleve esta marca.
    // Sin ella se imprimía cualquier cosa que hubiera cargado el marco —una vez
    // fue la aplicación entera sobre un rollo de 58 mm—, y como el modo
    // silencioso no abre diálogo, nada avisaba.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);

    const papel = comprobanteHtml(await comprobanteDe(ctx, mov.id));
    expect(papel).toContain('data-parquivo-ticket="1"');
  });

  it("respeta el ancho del rollo pedido", async () => {
    const { parqueaderoId } = await conTarifas();
    const ctx = comoOperario(parqueaderoId);
    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    const c = await comprobanteDe(ctx, mov.id);

    expect(comprobanteHtml(c, 58)).toContain("size: 58mm auto");
    expect(comprobanteHtml(c, 80)).toContain("size: 80mm auto");
  });

  it("escapa lo que escribió una persona", async () => {
    // El nombre del establecimiento y el motivo de una cortesía los escribe
    // alguien. Sin escapar, un `<` rompe el documento que va a la impresora.
    const { parqueaderoId } = await conTarifas();
    const ctx = comoAdminDe(parqueaderoId);

    const mov = await registrarEntrada(ctx, "ABC123", ENTRADA);
    await registrarCortesia(ctx, mov.id, 'Cortesía <b>especial</b> & "gratis"', SALIDA);

    const html = comprobanteHtml(await comprobanteDe(ctx, mov.id));
    expect(html).toContain("&lt;b&gt;especial&lt;/b&gt;");
    expect(html).not.toContain("<b>especial</b>");
  });
});
