import type { CuentaListada } from "./listar";

export type GrupoCuentas = {
  /** Identificador estable, para la key de React y para anclas. */
  clave: string;
  titulo: string;
  /** Explica qué es el grupo cuando no es un establecimiento. */
  nota: string | null;
  /** Presente sólo si el grupo es un establecimiento real. */
  establecimientoId: string | null;
  cuentas: CuentaListada[];
};

export const CLAVE_PLATAFORMA = "plataforma";
export const CLAVE_SIN_ASIGNAR = "sin-asignar";

/**
 * Agrupa las cuentas por establecimiento, que es como el administrador general
 * las piensa: "quién trabaja en El Centro", no "todas las cuentas del sistema".
 *
 * Hay dos grupos que no son establecimientos y que igual deben aparecer, porque
 * si no, sus cuentas se volverían invisibles:
 *
 *   - Los administradores generales, que por definición no pertenecen a ningún
 *     establecimiento: mandan sobre todos.
 *   - Las cuentas sin asignación, que casi siempre son un error de alta y
 *     conviene que salten a la vista en vez de quedar escondidas.
 *
 * El orden es deliberado: primero la plataforma, después los establecimientos
 * alfabéticamente, y al final lo que quedó sin asignar. Lo excepcional va
 * primero y último; lo cotidiano, ordenado en el medio.
 */
export function agruparPorEstablecimiento(
  cuentas: readonly CuentaListada[],
): GrupoCuentas[] {
  const establecimientos = new Map<string, GrupoCuentas>();
  const plataforma: CuentaListada[] = [];
  const sinAsignar: CuentaListada[] = [];

  for (const c of cuentas) {
    if (c.establecimientoId && c.establecimiento) {
      const grupo = establecimientos.get(c.establecimientoId) ?? {
        clave: c.establecimientoId,
        titulo: c.establecimiento,
        nota: null,
        establecimientoId: c.establecimientoId,
        cuentas: [],
      };
      grupo.cuentas.push(c);
      establecimientos.set(c.establecimientoId, grupo);
    } else if (c.rol === "admin_general") {
      plataforma.push(c);
    } else {
      sinAsignar.push(c);
    }
  }

  const ordenados = [...establecimientos.values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "es"),
  );

  const grupos: GrupoCuentas[] = [];

  if (plataforma.length > 0) {
    grupos.push({
      clave: CLAVE_PLATAFORMA,
      titulo: "Administración de la plataforma",
      nota: "Cuentas con alcance sobre todos los establecimientos.",
      establecimientoId: null,
      cuentas: plataforma,
    });
  }

  grupos.push(...ordenados);

  if (sinAsignar.length > 0) {
    grupos.push({
      clave: CLAVE_SIN_ASIGNAR,
      titulo: "Sin establecimiento",
      nota: "Estas cuentas no están vinculadas a ningún parqueadero, así que no pueden trabajar en ninguno.",
      establecimientoId: null,
      cuentas: sinAsignar,
    });
  }

  return grupos;
}
