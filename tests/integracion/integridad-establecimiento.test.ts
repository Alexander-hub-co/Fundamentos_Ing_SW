import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { darDeBajaParqueadero } from "@/dominio/parqueaderos/baja";
import { reactivarParqueadero } from "@/dominio/parqueaderos/reactivar";
import { historialDeEstados } from "@/dominio/parqueaderos/historial-estado";
import { asignarAdministrador } from "@/dominio/parqueaderos/asignaciones";
import { listarParqueaderos } from "@/dominio/parqueaderos/listar";
import type { Contexto } from "@/lib/sesion";

/**
 * Verificación del Principio IV sobre establecimientos.
 *
 * La constitución exige comprobar la integridad del historial con pruebas
 * automatizadas, no con revisión visual. Lo que se demuestra acá es que dar de
 * baja un establecimiento NO destruye ninguna fila ni ninguna referencia: la
 * baja es un cambio de estado, no un borrado.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-general",
  rol: "admin_general",
};

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    // Las tablas de auditoría se limpian primero: sus claves foráneas hacia
    // la cuenta son justamente lo que impide borrar historial en producción.
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    // Las credenciales dependen de la cuenta: sin borrarlas primero, el
    // borrado de `user` falla por clave foránea si otro archivo dejó cuentas.
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values([
      { id: "u-general", name: "Admin General", email: "g@ejemplo.co" },
      { id: "u-resp", name: "Responsable", email: "r@ejemplo.co" },
    ]);
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("la baja es lógica: no destruye nada (FR-040, FR-042)", () => {
  it("la fila del establecimiento sobrevive con todos sus datos", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, {
      nombre: "Parqueadero Norte",
      ciudad: "Cali",
      telefono: "3001234567",
    });

    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Cerró el negocio",
      confirmado: true,
    });

    const [tras] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(parqueadero).where(eq(parqueadero.id, p.id)),
    );

    expect(tras).toBeDefined();
    expect(tras!.nombre).toBe("Parqueadero Norte");
    expect(tras!.ciudad).toBe("Cali");
    expect(tras!.telefono).toBe("3001234567");
    expect(tras!.codigo).toBe(p.codigo);
    expect(tras!.estado).toBe("dado_de_baja");
  });

  it("las asignaciones que lo referencian siguen existiendo", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Con responsable" });
    await asignarAdministrador(ADMIN_GENERAL, {
      usuarioId: "u-resp",
      parqueaderoId: p.id,
      rol: "admin_parqueadero",
    });

    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Cerró",
      confirmado: true,
    });

    const vinculos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(asignacion).where(eq(asignacion.parqueaderoId, p.id)),
    );

    expect(vinculos).toHaveLength(1);
    expect(vinculos[0]!.usuarioId).toBe("u-resp");
  });

  it("el historial de estados se conserva íntegro", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Con historial" });

    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Cerró temporalmente",
      confirmado: true,
    });

    const historial = await historialDeEstados(p.id);
    expect(historial).toHaveLength(1);
    expect(historial[0]!.motivo).toBe("Cerró temporalmente");
  });

  it("sigue siendo consultable por el administrador general", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "De baja" });
    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Cerró",
      confirmado: true,
    });

    const todos = await listarParqueaderos(ADMIN_GENERAL);
    expect(todos.map((x) => x.id)).toContain(p.id);

    const soloBaja = await listarParqueaderos(ADMIN_GENERAL, {
      estado: "dado_de_baja",
    });
    expect(soloBaja).toHaveLength(1);
  });
});

describe("la reactivación devuelve todo tal como estaba (FR-029)", () => {
  it("tras dar de baja y reactivar, la información es idéntica", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, {
      nombre: "Ida y vuelta",
      ciudad: "Palmira",
      direccion: "Calle 5 #10-20",
    });
    await asignarAdministrador(ADMIN_GENERAL, {
      usuarioId: "u-resp",
      parqueaderoId: p.id,
      rol: "admin_parqueadero",
    });

    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Pausa",
      confirmado: true,
    });
    const { parqueadero: revivido } = await reactivarParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Volvió",
    });

    expect(revivido.estado).toBe("activo");
    expect(revivido.nombre).toBe(p.nombre);
    expect(revivido.ciudad).toBe(p.ciudad);
    expect(revivido.direccion).toBe(p.direccion);
    expect(revivido.codigo).toBe(p.codigo);
    expect(revivido.creadoEn).toEqual(p.creadoEn);

    // Y su responsable sigue vinculado.
    const vinculos = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(asignacion).where(eq(asignacion.parqueaderoId, p.id)),
    );
    expect(vinculos).toHaveLength(1);
  });

  it("el historial acumula ambas transiciones, no las reemplaza", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Acumula" });
    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Baja",
      confirmado: true,
    });
    await reactivarParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Alta",
    });

    const historial = await historialDeEstados(p.id);
    expect(historial.map((h) => h.estadoNuevo)).toEqual(["activo", "dado_de_baja"]);
  });
});
