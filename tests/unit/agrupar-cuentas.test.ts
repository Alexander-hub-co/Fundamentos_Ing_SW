import { describe, expect, it } from "vitest";
import {
  agruparPorEstablecimiento,
  CLAVE_PLATAFORMA,
  CLAVE_SIN_ASIGNAR,
} from "@/dominio/cuentas/agrupar";
import type { CuentaListada } from "@/dominio/cuentas/listar";

function cuenta(parcial: Partial<CuentaListada>): CuentaListada {
  return {
    id: parcial.id ?? "u1",
    codigo: parcial.codigo ?? null,
    nombre: parcial.nombre ?? "Persona",
    email: parcial.email ?? "persona@ejemplo.co",
    bloqueada: false,
    anonimizada: false,
    debeCambiarPassword: false,
    rol: parcial.rol ?? "operario",
    establecimiento: parcial.establecimiento ?? null,
    establecimientoId: parcial.establecimientoId ?? null,
    ...parcial,
  };
}

describe("agrupar cuentas por establecimiento", () => {
  it("no inventa grupos cuando no hay cuentas", () => {
    expect(agruparPorEstablecimiento([])).toEqual([]);
  });

  it("reúne en un mismo grupo a la gente del mismo establecimiento", () => {
    const grupos = agruparPorEstablecimiento([
      cuenta({ id: "1", nombre: "Ana", establecimientoId: "p1", establecimiento: "El Centro" }),
      cuenta({ id: "2", nombre: "Luis", establecimientoId: "p1", establecimiento: "El Centro" }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.titulo).toBe("El Centro");
    expect(grupos[0]!.cuentas.map((c) => c.nombre)).toEqual(["Ana", "Luis"]);
  });

  it("ordena: la plataforma primero, los establecimientos alfabéticos, lo suelto al final", () => {
    const grupos = agruparPorEstablecimiento([
      cuenta({ id: "1", establecimientoId: "p2", establecimiento: "Zona Norte" }),
      cuenta({ id: "2", rol: "operario" }), // sin establecimiento
      cuenta({ id: "3", establecimientoId: "p1", establecimiento: "El Centro" }),
      cuenta({ id: "4", rol: "admin_general" }),
    ]);

    expect(grupos.map((g) => g.clave)).toEqual([
      CLAVE_PLATAFORMA,
      "p1",
      "p2",
      CLAVE_SIN_ASIGNAR,
    ]);
  });

  it("ordena los establecimientos respetando los acentos del español", () => {
    const grupos = agruparPorEstablecimiento([
      cuenta({ id: "1", establecimientoId: "b", establecimiento: "Zipaquirá" }),
      cuenta({ id: "2", establecimientoId: "a", establecimiento: "Ávila" }),
    ]);

    expect(grupos.map((g) => g.titulo)).toEqual(["Ávila", "Zipaquirá"]);
  });

  it("no crea los grupos especiales si están vacíos", () => {
    const grupos = agruparPorEstablecimiento([
      cuenta({ id: "1", establecimientoId: "p1", establecimiento: "El Centro" }),
    ]);

    expect(grupos.map((g) => g.clave)).toEqual(["p1"]);
  });

  it("manda a 'sin establecimiento' a quien tiene rol de trabajo pero ninguna asignación", () => {
    const grupos = agruparPorEstablecimiento([
      cuenta({ id: "1", rol: "admin_parqueadero", establecimientoId: null }),
    ]);

    expect(grupos[0]!.clave).toBe(CLAVE_SIN_ASIGNAR);
    expect(grupos[0]!.nota).toContain("no están vinculadas");
  });

  it("no pierde ninguna cuenta al repartirlas", () => {
    const entrada = [
      cuenta({ id: "1", establecimientoId: "p1", establecimiento: "A" }),
      cuenta({ id: "2", rol: "admin_general" }),
      cuenta({ id: "3" }),
      cuenta({ id: "4", establecimientoId: "p2", establecimiento: "B" }),
    ];

    const salidas = agruparPorEstablecimiento(entrada).flatMap((g) => g.cuentas);

    expect(salidas).toHaveLength(entrada.length);
    expect(new Set(salidas.map((c) => c.id))).toEqual(new Set(["1", "2", "3", "4"]));
  });
});
