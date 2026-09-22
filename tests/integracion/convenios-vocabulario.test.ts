import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import {
  agregarPlaca,
  conveniosDelEstablecimiento,
  declararConvenio,
  describirConvenio,
} from "@/dominio/convenios/gestionar";
import type { Contexto } from "@/lib/sesion";

/**
 * Historia 1 — los cuatro acuerdos que existen de verdad.
 *
 * La prueba que justifica la funcionalidad entera: antes de esto, sólo el
 * tercero de los cuatro era expresable. Un parqueadero con convenios de sello
 * —que son los más comunes en Colombia— simplemente no era cliente.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-voc", rol: "admin_general" };

const comoAdminDe = (parqueaderoId: string): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-voc",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado: "activo",
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-voc", name: "Admin", email: "voc@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

async function establecimiento() {
  const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero del Centro" });
  return comoAdminDe(p.id);
}

describe("los cuatro acuerdos del negocio se declaran sin tocar código", () => {
  it("el fruver que sella el ticket a cambio de una hora", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Fruver La Esquina",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 60,
    });

    expect(c.activacion).toBe("sello");
    expect(c.beneficio).toBe("minutos_gratis");
    expect(c.valor).toBe(60);
  });

  it("la carnicería, que da media hora", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Carnicería",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 30,
    });

    expect(c.valor).toBe(30);
  });

  it("el cliente frecuente, al que se le cobra la mitad", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Cliente frecuente",
      activacion: "placa",
      beneficio: "porcentaje",
      valor: 50,
    });

    await agregarPlaca(ctx, c.id, "abc 123");
    const [visto] = await conveniosDelEstablecimiento(ctx);
    expect(visto?.placas).toEqual(["ABC123"]);
  });

  it("la mensualidad, a la que no se le cobra la salida", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Mensualidad Torre B",
      activacion: "placa",
      beneficio: "sin_cobro",
    });

    // Sin cobro no lleva valor. Ponerlo en cero sería declarar que se cobra
    // cero, que es otra afirmación.
    expect(c.valor).toBeNull();
  });

  it("los cuatro conviven en el mismo establecimiento", async () => {
    const ctx = await establecimiento();
    await declararConvenio(ctx, { nombre: "Fruver", activacion: "sello", beneficio: "minutos_gratis", valor: 60 });
    await declararConvenio(ctx, { nombre: "Carnicería", activacion: "sello", beneficio: "minutos_gratis", valor: 30 });
    await declararConvenio(ctx, { nombre: "Frecuente", activacion: "placa", beneficio: "porcentaje", valor: 50 });
    await declararConvenio(ctx, { nombre: "Mensualidad", activacion: "placa", beneficio: "sin_cobro" });

    expect(await conveniosDelEstablecimiento(ctx)).toHaveLength(4);
  });
});

describe("los límites son del administrador, no del sistema", () => {
  it("acepta cualquier número de veces al día", async () => {
    const ctx = await establecimiento();
    for (const veces of [1, 3, 99]) {
      const c = await declararConvenio(ctx, {
        nombre: `Límite ${veces}`,
        activacion: "sello",
        beneficio: "minutos_gratis",
        valor: 30,
        limiteDiario: veces,
      });
      expect(c.limiteDiario).toBe(veces);
    }
  });

  it("sin límite se guarda como tal, no como un número grande", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Ilimitado",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 30,
      limiteDiario: null,
    });
    expect(c.limiteDiario).toBeNull();
  });

  it("el tope en pesos se conserva", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Con tope",
      activacion: "placa",
      beneficio: "porcentaje",
      valor: 50,
      topePesos: 5000,
    });
    expect(c.topePesos).toBe(5000);
  });
});

describe("cada convenio se lee en una línea", () => {
  it("dice cuándo aplica y qué hace", () => {
    expect(
      describirConvenio({
        activacion: "sello",
        beneficio: "minutos_gratis",
        valor: 60,
        topePesos: null,
        limiteDiario: null,
      }),
    ).toBe("Con sello: 60 minutos gratis");
  });

  it("nombra los límites cuando los hay", () => {
    expect(
      describirConvenio({
        activacion: "placa",
        beneficio: "porcentaje",
        valor: 50,
        topePesos: 5000,
        limiteDiario: 1,
      }),
    ).toBe("Por placa: 50 % de descuento · hasta $5.000 · una vez al día");
  });

  it("el sin cobro se dice con palabras, no con un cero", () => {
    expect(
      describirConvenio({
        activacion: "placa",
        beneficio: "sin_cobro",
        valor: null,
        topePesos: null,
        limiteDiario: null,
      }),
    ).toBe("Por placa: no se cobra la salida");
  });
});

describe("los acuerdos de larga duración se declaran por su nombre", () => {
  it("la mensualidad calcula su vencimiento sin que nadie escriba una fecha", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Mensualidad Torre B",
      activacion: "placa",
      beneficio: "sin_cobro",
      periodicidad: "mensual",
    });

    expect(c.periodicidad).toBe("mensual");
    expect(c.hasta).not.toBeNull();
    expect(c.hasta!.getTime()).toBeGreaterThan(c.desde.getTime());

    // Un mes exacto: el mismo día del mes siguiente, no treinta jornadas.
    const esperado = new Date(c.desde);
    esperado.setMonth(esperado.getMonth() + 1);
    expect(c.hasta!.getMonth()).toBe(esperado.getMonth());
  });

  it("las cuatro duraciones se guardan y se distinguen", async () => {
    const ctx = await establecimiento();
    for (const d of ["mensual", "trimestral", "semestral", "anual"] as const) {
      const c = await declararConvenio(ctx, {
        nombre: `Acuerdo ${d}`,
        activacion: "placa",
        beneficio: "sin_cobro",
        periodicidad: d,
      });
      expect(c.periodicidad).toBe(d);
    }
  });

  it("la descripción nombra la duración en vez de mostrar una fecha suelta", async () => {
    expect(
      describirConvenio({
        activacion: "placa",
        beneficio: "sin_cobro",
        valor: null,
        topePesos: null,
        limiteDiario: null,
        periodicidad: "mensual",
      }),
    ).toBe("Por placa: no se cobra la salida · mensual");
  });

  it("sin duración declarada, la vigencia sigue siendo la fecha o ninguna", async () => {
    const ctx = await establecimiento();
    const c = await declararConvenio(ctx, {
      nombre: "Sin vencimiento",
      activacion: "sello",
      beneficio: "minutos_gratis",
      valor: 60,
    });

    expect(c.periodicidad).toBeNull();
    expect(c.hasta).toBeNull();
  });
});
