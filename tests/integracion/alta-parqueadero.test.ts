import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, sesion, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { editarParqueadero } from "@/dominio/parqueaderos/editar";
import {
  CuentaYaAsignada,
  asignarAdministrador,
} from "@/dominio/parqueaderos/asignaciones";
import {
  listarParqueaderos,
  obtenerMiParqueadero,
} from "@/dominio/parqueaderos/listar";
import { NoAutorizado } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/**
 * Historia 1 — Dar de alta un parqueadero y su administrador.
 *
 * Corre contra PostgreSQL real: las políticas RLS son parte de lo que se está
 * probando, sobre todo en el escenario donde el administrador de A no alcanza
 * los datos de B.
 */

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "seed-admin-general",
  rol: "admin_general",
};

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from ${sesion}`);
    // Las credenciales dependen de la cuenta: si otro archivo de pruebas dejó
    // cuentas creadas, sin esto el borrado de `user` falla por clave foránea y
    // la causa —estado ajeno— no se parece en nada al síntoma.
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from ${asignacion}`);
    await tx.execute(sql`delete from ${parqueadero}`);
    // Las tablas de auditoría se limpian primero: sus claves foráneas hacia
    // la cuenta son justamente lo que impide borrar historial en producción.
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    // El contexto de las pruebas usa este identificador; sin la fila, el
    // registro de auditoría falla por clave foránea y la ruta no se ejercita.
    await tx.insert(usuario).values({
      id: "seed-admin-general",
      name: "Admin General",
      email: "seed@ejemplo.co",
    });
  });
}

async function crearCuenta(id: string, email: string) {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.insert(usuario).values({ id, name: `Cuenta ${id}`, email });
  });
  return id;
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("escenario 1 — el establecimiento queda creado y activo", () => {
  it("nace en estado activo y aparece en el listado general", async () => {
    const creado = await crearParqueadero(ADMIN_GENERAL, {
      nombre: "Parqueadero Centro",
      ciudad: "Cali",
    });

    expect(creado.estado).toBe("activo");

    const listado = await listarParqueaderos(ADMIN_GENERAL);
    expect(listado.map((p) => p.nombre)).toContain("Parqueadero Centro");
  });

  it("rechaza un nombre vacío", async () => {
    await expect(
      crearParqueadero(ADMIN_GENERAL, { nombre: "   " }),
    ).rejects.toThrow(/nombre/i);
  });
});

describe("escenario 2 — la persona asignada accede a su establecimiento y a ningún otro", () => {
  it("la asignación queda registrada con su rol", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Norte" });
    const cuenta = await crearCuenta("u-1", "admin1@ejemplo.co");

    const vinculo = await asignarAdministrador(ADMIN_GENERAL, {
      usuarioId: cuenta,
      parqueaderoId: p.id,
      rol: "admin_parqueadero",
    });

    expect(vinculo.parqueaderoId).toBe(p.id);
    expect(vinculo.rol).toBe("admin_parqueadero");
  });

  it("una cuenta ya vinculada no se puede asignar a otro establecimiento (FR-020)", async () => {
    const a = await crearParqueadero(ADMIN_GENERAL, { nombre: "A" });
    const b = await crearParqueadero(ADMIN_GENERAL, { nombre: "B" });
    const cuenta = await crearCuenta("u-2", "admin2@ejemplo.co");

    await asignarAdministrador(ADMIN_GENERAL, {
      usuarioId: cuenta,
      parqueaderoId: a.id,
      rol: "admin_parqueadero",
    });

    await expect(
      asignarAdministrador(ADMIN_GENERAL, {
        usuarioId: cuenta,
        parqueaderoId: b.id,
        rol: "admin_parqueadero",
      }),
    ).rejects.toThrow(CuentaYaAsignada);
  });
});

describe("escenario 3 — el administrador ve su establecimiento, no el ajeno", () => {
  it("obtenerMiParqueadero devuelve el propio y sólo el propio", async () => {
    const a = await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero A" });
    await crearParqueadero(ADMIN_GENERAL, { nombre: "Parqueadero B" });
    const cuenta = await crearCuenta("u-3", "admin3@ejemplo.co");

    await asignarAdministrador(ADMIN_GENERAL, {
      usuarioId: cuenta,
      parqueaderoId: a.id,
      rol: "admin_parqueadero",
    });

    const contextoDeA: Contexto = {
      tipo: "establecimiento",
      usuarioId: cuenta,
      rol: "admin_parqueadero",
      parqueaderoId: a.id,
      estado: "activo",
    };

    const propio = await obtenerMiParqueadero(contextoDeA);
    expect(propio?.nombre).toBe("Parqueadero A");
  });

  it("un administrador de establecimiento no puede listar todos", async () => {
    const contexto: Contexto = {
      tipo: "establecimiento",
      usuarioId: "u-4",
      rol: "admin_parqueadero",
      parqueaderoId: "00000000-0000-0000-0000-000000000000",
      estado: "activo",
    };

    await expect(listarParqueaderos(contexto)).rejects.toThrow(NoAutorizado);
  });
});

describe("escenario 4 — el código es único e inmutable", () => {
  it("se asigna automáticamente con la forma esperada", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Sur" });
    expect(p.codigo).toBe("SUR");
  });

  it("sale del nombre, para que se lea a qué establecimiento pertenece", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, {
      nombre: "Parqueadero Centro Historico",
    });
    expect(p.codigo).toBe("PCH");
  });

  it("desempata alargando cuando dos nombres dan la misma sigla", async () => {
    const a = await crearParqueadero(ADMIN_GENERAL, { nombre: "Torre Alta Norte" });
    const b = await crearParqueadero(ADMIN_GENERAL, { nombre: "Terminal Aguas Negras" });

    expect(a.codigo).toBe("TAN");
    expect(b.codigo).toBe("TAN2");
  });

  it("dos establecimientos reciben códigos distintos", async () => {
    const a = await crearParqueadero(ADMIN_GENERAL, { nombre: "Uno" });
    const b = await crearParqueadero(ADMIN_GENERAL, { nombre: "Dos" });
    expect(a.codigo).not.toBe(b.codigo);
  });

  it("la edición rechaza cualquier intento de tocar el código (FR-017)", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Este" });

    await expect(
      editarParqueadero(ADMIN_GENERAL, p.id, {
        nombre: "Este renombrado",
        codigo: "PQV-HACKED",
      } as never),
    ).rejects.toThrow(/código/i);
  });

  it("la base rechaza el cambio de código incluso saltándose el dominio", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Oeste" });

    // Drizzle envuelve el error del motor, así que el mensaje del disparador
    // viaja en `cause`. Se recorre la cadena para no depender de la envoltura.
    const error = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(
        sql`update ${parqueadero} set codigo = 'PQV-XXXXXX' where id = ${p.id}`,
      ),
    ).catch((e: unknown) => e);

    const mensajes: string[] = [];
    for (let e = error; e instanceof Error; e = e.cause) {
      mensajes.push(e.message);
    }

    expect(mensajes.join(" | ")).toMatch(/inmutable/i);

    // Y lo que de verdad importa: el código sigue siendo el original.
    const [sinCambios] = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(parqueadero).limit(1),
    );
    expect(sinCambios!.codigo).toBe(p.codigo);
  });

  it("la edición sí cambia los datos descriptivos", async () => {
    const p = await crearParqueadero(ADMIN_GENERAL, { nombre: "Viejo" });
    const editado = await editarParqueadero(ADMIN_GENERAL, p.id, {
      nombre: "Nuevo",
      ciudad: "Medellín",
    });

    expect(editado.nombre).toBe("Nuevo");
    expect(editado.ciudad).toBe("Medellín");
    expect(editado.codigo).toBe(p.codigo);
  });
});
