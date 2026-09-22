import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { cambiarEstadoParqueadero, MotivoRequerido } from "@/dominio/parqueaderos/cambiar-estado";
import { darDeBajaParqueadero, BajaRequiereConfirmacion } from "@/dominio/parqueaderos/baja";
import { reactivarParqueadero } from "@/dominio/parqueaderos/reactivar";
import { historialDeEstados } from "@/dominio/parqueaderos/historial-estado";
import { TransicionInvalida } from "@/dominio/parqueaderos/estados";
import { editarMiParqueadero } from "@/dominio/parqueaderos/editar";
import { obtenerMiParqueadero } from "@/dominio/parqueaderos/listar";
import { EstablecimientoRestringido, EstablecimientoDadoDeBaja } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero } from "@/db/esquema";

/** Historia 3 — Suspender y reactivar un establecimiento. */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-general",
  rol: "admin_general",
};

const enEstado = (
  id: string,
  estado: EstadoParqueadero,
  rol: "admin_parqueadero" | "operario" = "admin_parqueadero",
): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-admin-parq",
  rol,
  parqueaderoId: id,
  estado,
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    // Las tablas de auditoría se limpian primero: sus claves foráneas hacia
    // la cuenta son justamente lo que impide borrar historial en producción.
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values([
      { id: "u-general", name: "Admin General", email: "g@ejemplo.co" },
      { id: "u-admin-parq", name: "Admin Parqueadero", email: "p@ejemplo.co" },
    ]);
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

async function nuevoParqueadero(nombre = "Central") {
  return crearParqueadero(ADMIN_GENERAL, { nombre });
}

describe("escenario 1 — suspender pone al establecimiento en modo restringido", () => {
  it("el estado cambia y sus usuarios quedan restringidos", async () => {
    const p = await nuevoParqueadero();

    const { parqueadero: suspendido } = await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Pago pendiente desde marzo",
    });

    expect(suspendido.estado).toBe("suspendido");

    // La edición se bloquea…
    await expect(
      editarMiParqueadero(enEstado(p.id, "suspendido"), { nombre: "Otro" }),
    ).rejects.toThrow(EstablecimientoRestringido);
  });

  it("…pero la consulta sigue disponible, para poder cerrar lo pendiente", async () => {
    const p = await nuevoParqueadero();
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Impago",
    });

    const propio = await obtenerMiParqueadero(enEstado(p.id, "suspendido", "operario"));
    expect(propio?.id).toBe(p.id);
  });
});

describe("escenarios 2 y 3 — el modo restringido deja cerrar, no abrir", () => {
  it("las operaciones nuevas se rechazan y las de consulta no", async () => {
    const p = await nuevoParqueadero();
    const contexto = enEstado(p.id, "suspendido");

    // En F1 todavía no existen movimientos; lo que se verifica es el punto de
    // control que F3 usará: consultar sí, modificar no.
    await expect(
      editarMiParqueadero(contexto, { nombre: "Nuevo" }),
    ).rejects.toThrow(/suspendido/);

    await expect(
      obtenerMiParqueadero(enEstado(p.id, "suspendido", "operario")),
    ).resolves.not.toBeNull();
  });
});

describe("escenario 4 — la reactivación restituye el acceso pleno sin pérdida", () => {
  it("vuelve a activo y la información queda idéntica", async () => {
    const p = await nuevoParqueadero("Con datos");

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Impago",
    });

    const { parqueadero: reactivado } = await reactivarParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Pagó",
    });

    expect(reactivado.estado).toBe("activo");
    expect(reactivado.nombre).toBe(p.nombre);
    expect(reactivado.codigo).toBe(p.codigo);
    expect(reactivado.creadoEn).toEqual(p.creadoEn);

    // Y el acceso vuelve a funcionar.
    await expect(
      editarMiParqueadero(enEstado(p.id, "activo"), { nombre: "Editado" }),
    ).resolves.toBeDefined();
  });
});

describe("escenario 5 — el administrador general sigue viendo el establecimiento suspendido", () => {
  it("la suspensión afecta a los usuarios del establecimiento, no a la visibilidad global", async () => {
    const p = await nuevoParqueadero();
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Impago",
    });

    const visto = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(parqueadero).where(eq(parqueadero.id, p.id)),
    );

    expect(visto).toHaveLength(1);
    expect(visto[0]!.estado).toBe("suspendido");
  });
});

describe("escenario 6 — todo cambio registra quién, cuándo y por qué (FR-026)", () => {
  it("anota cada transición con su motivo y su autor", async () => {
    const p = await nuevoParqueadero();

    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "pendiente",
      motivo: "Se atrasó con el pago de agosto",
    });
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Sigue sin pagar tras dos avisos",
    });

    const historial = await historialDeEstados(p.id);

    expect(historial).toHaveLength(2);
    expect(historial[0]!.estadoNuevo).toBe("suspendido");
    expect(historial[0]!.estadoAnterior).toBe("pendiente");
    expect(historial[0]!.motivo).toBe("Sigue sin pagar tras dos avisos");
    expect(historial[0]!.ejecutadoPor).toBe("Admin General");
    expect(historial[1]!.estadoNuevo).toBe("pendiente");
  });

  it("el historial sobrevive a cambios de estado posteriores", async () => {
    const p = await nuevoParqueadero();
    for (const [estado, motivo] of [
      ["suspendido", "Impago"],
      ["activo", "Pagó"],
      ["dado_de_baja", "Se fue"],
    ] as const) {
      await cambiarEstadoParqueadero(ADMIN_GENERAL, {
        parqueaderoId: p.id,
        nuevoEstado: estado,
        motivo,
      });
    }

    expect(await historialDeEstados(p.id)).toHaveLength(3);
  });

  it("exige motivo: un corte de servicio sin explicación no se registra", async () => {
    const p = await nuevoParqueadero();
    await expect(
      cambiarEstadoParqueadero(ADMIN_GENERAL, {
        parqueaderoId: p.id,
        nuevoEstado: "suspendido",
        motivo: "   ",
      }),
    ).rejects.toThrow(MotivoRequerido);
  });
});

describe("escenario 7 — pendiente se comporta igual que activo (FR-024)", () => {
  it("no restringe ninguna operación", async () => {
    const p = await nuevoParqueadero();
    await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "pendiente",
      motivo: "Marca de gestión",
    });

    await expect(
      editarMiParqueadero(enEstado(p.id, "pendiente"), { nombre: "Editado" }),
    ).resolves.toBeDefined();
  });
});

describe("dar de baja", () => {
  it("exige confirmación explícita", async () => {
    const p = await nuevoParqueadero();
    await expect(
      darDeBajaParqueadero(ADMIN_GENERAL, {
        parqueaderoId: p.id,
        motivo: "Cerró",
      }),
    ).rejects.toThrow(BajaRequiereConfirmacion);
  });

  it("con confirmación lleva al estado terminal y corta todo acceso", async () => {
    const p = await nuevoParqueadero();
    const { parqueadero: baja } = await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Cerró el negocio",
      confirmado: true,
    });

    expect(baja.estado).toBe("dado_de_baja");
    await expect(
      obtenerMiParqueadero(enEstado(p.id, "dado_de_baja", "operario")),
    ).rejects.toThrow(EstablecimientoDadoDeBaja);
  });
});

describe("transiciones inválidas (FR-023)", () => {
  it("no se puede pasar de dado de baja a suspendido", async () => {
    const p = await nuevoParqueadero();
    await darDeBajaParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      motivo: "Cerró",
      confirmado: true,
    });

    await expect(
      cambiarEstadoParqueadero(ADMIN_GENERAL, {
        parqueaderoId: p.id,
        nuevoEstado: "suspendido",
        motivo: "Intento inválido",
      }),
    ).rejects.toThrow(TransicionInvalida);
  });

  it("no se puede transicionar al mismo estado", async () => {
    const p = await nuevoParqueadero();
    await expect(
      cambiarEstadoParqueadero(ADMIN_GENERAL, {
        parqueaderoId: p.id,
        nuevoEstado: "activo",
        motivo: "Ya está activo",
      }),
    ).rejects.toThrow(/ya está/);
  });
});

describe("SC-004 — el cambio alcanza a las sesiones ya abiertas", () => {
  it("suspender revoca las sesiones de los usuarios del establecimiento", async () => {
    const p = await nuevoParqueadero();

    await comoPlataforma("administracion_plataforma", async (tx) => {
      await tx.insert(asignacion).values({
        usuarioId: "u-admin-parq",
        parqueaderoId: p.id,
        rol: "admin_parqueadero",
      });
      await tx.insert(sesion).values({
        id: "s-1",
        token: "tok-1",
        userId: "u-admin-parq",
        expiresAt: new Date(Date.now() + 3_600_000),
      });
    });

    const { sesionesRevocadas } = await cambiarEstadoParqueadero(ADMIN_GENERAL, {
      parqueaderoId: p.id,
      nuevoEstado: "suspendido",
      motivo: "Impago",
    });

    expect(sesionesRevocadas).toBe(1);

    const quedan = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(sesion).where(eq(sesion.userId, "u-admin-parq")),
    );
    expect(quedan).toHaveLength(0);
  });
});
