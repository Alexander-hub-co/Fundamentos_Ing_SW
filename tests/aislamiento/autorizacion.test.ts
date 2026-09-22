import { describe, expect, it } from "vitest";
import {
  NoAutorizado,
  exigir,
  puede,
  type Operacion,
} from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import type { EstadoParqueadero, RolUsuario } from "@/db/esquema";

/**
 * Prueba negativa de autorización (FR-003).
 *
 * Invoca el control directamente, sin pasar por ninguna interfaz: es
 * precisamente el camino que usaría alguien que descubre el nombre de una
 * operación e intenta ejecutarla desde fuera de la pantalla que la ofrece.
 */

const OPERARIO: Contexto = {
  tipo: "establecimiento",
  usuarioId: "u-operario",
  rol: "operario",
  parqueaderoId: "p-1",
  estado: "activo",
};

const ADMIN_PARQUEADERO: Contexto = {
  tipo: "establecimiento",
  usuarioId: "u-admin",
  rol: "admin_parqueadero",
  parqueaderoId: "p-1",
  estado: "activo",
};

/** Construye un contexto de establecimiento con el estado y rol indicados. */
function enEstablecimiento(
  estado: EstadoParqueadero,
  rol: Exclude<RolUsuario, "admin_general"> = "admin_parqueadero",
): Contexto {
  return {
    tipo: "establecimiento",
    usuarioId: "u-test",
    rol,
    parqueaderoId: "p-1",
    estado,
  };
}

const ADMIN_GENERAL: Contexto = {
  tipo: "plataforma",
  usuarioId: "u-general",
  rol: "admin_general",
};

const OPERACIONES_DE_PLATAFORMA: Operacion[] = [
  "parqueadero.crear",
  "parqueadero.editar.cualquiera",
  "parqueadero.listar.todos",
  "parqueadero.cambiar_estado",
  "parqueadero.dar_de_baja",
  "parqueadero.asignar_administrador",
  "cuenta.crear",
  "cuenta.restablecer_password",
  "cuenta.bloquear",
  "cuenta.dar_de_baja",
  "cuenta.anonimizar",
  "plataforma.resumen",
];

describe("un operario no alcanza ninguna operación de administrador", () => {
  it.each(OPERACIONES_DE_PLATAFORMA)("rechaza %s", (operacion) => {
    expect(puede(OPERARIO, operacion)).toBe(false);
    expect(() => exigir(OPERARIO, operacion)).toThrow(NoAutorizado);
  });
});

describe("un administrador de parqueadero tampoco alcanza la plataforma", () => {
  it.each(OPERACIONES_DE_PLATAFORMA)("rechaza %s", (operacion) => {
    expect(() => exigir(ADMIN_PARQUEADERO, operacion)).toThrow(NoAutorizado);
  });

  it("pero sí puede editar su propio establecimiento", () => {
    expect(() => exigir(ADMIN_PARQUEADERO, "parqueadero.editar.propio")).not.toThrow();
  });
});

describe("separación dentro del establecimiento", () => {
  it("el operario ve su establecimiento pero no lo edita", () => {
    expect(() => exigir(OPERARIO, "parqueadero.ver.propio")).not.toThrow();
    expect(() => exigir(OPERARIO, "parqueadero.editar.propio")).toThrow(NoAutorizado);
  });
});

describe("el administrador general no hereda las operaciones de establecimiento", () => {
  it("no puede editar 'su' parqueadero porque no tiene ninguno", () => {
    expect(puede(ADMIN_GENERAL, "parqueadero.editar.propio")).toBe(false);
  });

  it("sí puede toda la administración de plataforma", () => {
    for (const op of OPERACIONES_DE_PLATAFORMA) {
      expect(() => exigir(ADMIN_GENERAL, op)).not.toThrow();
    }
  });
});

describe("el estado del establecimiento se aplica desde el contexto", () => {
  it("activo y pendiente se comportan igual (FR-024)", () => {
    for (const estado of ["activo", "pendiente"] as const) {
      expect(() =>
        exigir(enEstablecimiento(estado), "parqueadero.editar.propio"),
      ).not.toThrow();
    }
  });

  it("suspendido bloquea la edición pero no la consulta", () => {
    expect(() => exigir(enEstablecimiento("suspendido"), "parqueadero.editar.propio")).toThrow(
      /suspendido/,
    );
    expect(() =>
      exigir(enEstablecimiento("suspendido", "operario"), "parqueadero.ver.propio"),
    ).not.toThrow();
  });

  it("dado de baja no deja hacer absolutamente nada (FR-041)", () => {
    expect(() => exigir(enEstablecimiento("dado_de_baja"), "parqueadero.editar.propio")).toThrow(
      /baja/i,
    );
    expect(() =>
      exigir(enEstablecimiento("dado_de_baja", "operario"), "parqueadero.ver.propio"),
    ).toThrow(/baja/i);
  });

  it("el administrador general no se ve afectado: no pertenece a ningún establecimiento", () => {
    for (const op of OPERACIONES_DE_PLATAFORMA) {
      expect(() => exigir(ADMIN_GENERAL, op)).not.toThrow();
    }
  });
});
