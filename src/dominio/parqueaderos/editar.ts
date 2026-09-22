import { eq } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { parqueadero, type Parqueadero } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { DatosInvalidos } from "./crear";

export type DatosEdicion = {
  nombre?: string;
  direccion?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
};

export class CodigoInmutable extends Error {
  constructor() {
    super("El código del establecimiento no se puede modificar (FR-017)");
    this.name = "CodigoInmutable";
  }
}

/**
 * El tipo ya impide enviar `codigo`, pero un objeto que llega de una petición
 * HTTP no está tipado en tiempo de ejecución. Esta comprobación es la que
 * realmente sostiene FR-017 en la frontera, además del disparador de la base.
 */
function rechazarCambioDeCodigo(datos: object) {
  if ("codigo" in datos) throw new CodigoInmutable();
}

function normalizar(datos: DatosEdicion) {
  const cambios: Partial<Parqueadero> = { actualizadoEn: new Date() };

  if (datos.nombre !== undefined) {
    const nombre = datos.nombre.trim();
    if (nombre.length === 0) {
      throw new DatosInvalidos("El nombre del establecimiento es obligatorio");
    }
    cambios.nombre = nombre;
  }
  if (datos.direccion !== undefined) cambios.direccion = datos.direccion?.trim() || null;
  if (datos.ciudad !== undefined) cambios.ciudad = datos.ciudad?.trim() || null;
  if (datos.telefono !== undefined) cambios.telefono = datos.telefono?.trim() || null;

  return cambios;
}

/** Edición por el administrador general, sobre cualquier establecimiento (FR-017). */
export async function editarParqueadero(
  contexto: Contexto,
  id: string,
  datos: DatosEdicion,
): Promise<Parqueadero> {
  exigir(contexto, "parqueadero.editar.cualquiera");
  rechazarCambioDeCodigo(datos);

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [actualizado] = await tx
      .update(parqueadero)
      .set(normalizar(datos))
      .where(eq(parqueadero.id, id))
      .returning();

    if (!actualizado) throw new DatosInvalidos("El establecimiento no existe");
    return actualizado;
  });
}

/**
 * Edición por el administrador del propio establecimiento (FR-022).
 *
 * No recibe identificador: el ámbito sale de la sesión y la política RLS acota
 * el UPDATE por sí sola. Un parámetro que no existe no se puede manipular.
 */
export async function editarMiParqueadero(
  contexto: Contexto,
  datos: DatosEdicion,
): Promise<Parqueadero> {
  exigir(contexto, "parqueadero.editar.propio");
  rechazarCambioDeCodigo(datos);

  if (contexto.tipo !== "establecimiento") {
    throw new DatosInvalidos("El contexto no pertenece a ningún establecimiento");
  }

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [actualizado] = await tx
      .update(parqueadero)
      .set(normalizar(datos))
      .returning();

    if (!actualizado) throw new DatosInvalidos("El establecimiento no existe");
    return actualizado;
  });
}
