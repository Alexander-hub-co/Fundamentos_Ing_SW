import { desc, eq } from "drizzle-orm";
import { comoPlataforma, conAmbito } from "@/db/ambito";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import type { EstadoParqueadero, Parqueadero } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import type { Contexto } from "@/lib/sesion";

export type ParqueaderoListado = Parqueadero & {
  responsables: { id: string; nombre: string; email: string }[];
};

/**
 * Listado completo de establecimientos para el administrador general (FR-021).
 *
 * Es un ejercicio del privilegio global, y como tal queda registrado por
 * `comoPlataforma` — lo pide el escenario 4 de la historia 2.
 */
export async function listarParqueaderos(
  contexto: Contexto,
  filtros: { estado?: EstadoParqueadero } = {},
): Promise<ParqueaderoListado[]> {
  exigir(contexto, "parqueadero.listar.todos");

  // Escenario 4 de la historia 2: el administrador general sí accede a todos
  // los establecimientos, y ese privilegio queda registrado como acción
  // auditable.
  //
  // Se ESPERA el registro a propósito. Dispararlo sin esperar ahorraría unos
  // milisegundos en una operación administrativa poco frecuente, a cambio de
  // que el asiento pueda perderse — y una auditoría que a veces no se escribe
  // no sirve como auditoría.
  await registrarUsoPrivilegio(contexto, "parqueadero.listar.todos");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const base = tx.select().from(parqueadero).$dynamic();
    const filas = await (filtros.estado
      ? base.where(eq(parqueadero.estado, filtros.estado))
      : base
    ).orderBy(desc(parqueadero.creadoEn));

    if (filas.length === 0) return [];

    const vinculos = await tx
      .select({
        parqueaderoId: asignacion.parqueaderoId,
        id: usuario.id,
        nombre: usuario.name,
        email: usuario.email,
      })
      .from(asignacion)
      .innerJoin(usuario, eq(usuario.id, asignacion.usuarioId))
      .where(eq(asignacion.rol, "admin_parqueadero"));

    const porParqueadero = new Map<string, ParqueaderoListado["responsables"]>();
    for (const v of vinculos) {
      if (!v.parqueaderoId) continue;
      const lista = porParqueadero.get(v.parqueaderoId) ?? [];
      lista.push({ id: v.id, nombre: v.nombre, email: v.email });
      porParqueadero.set(v.parqueaderoId, lista);
    }

    return filas.map((p) => ({
      ...p,
      responsables: porParqueadero.get(p.id) ?? [],
    }));
  });
}

/**
 * Un establecimiento concreto, para el administrador general.
 *
 * Existe para que la interfaz no tenga que alcanzar la conexión privilegiada
 * por su cuenta: la decisión de ejercer el privilegio se toma acá, después de
 * exigir autorización, y no en una pantalla.
 */
export async function obtenerParqueadero(
  contexto: Contexto,
  id: string,
): Promise<Parqueadero | null> {
  exigir(contexto, "parqueadero.listar.todos");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [encontrado] = await tx
      .select()
      .from(parqueadero)
      .where(eq(parqueadero.id, id))
      .limit(1);
    return encontrado ?? null;
  });
}

/**
 * El establecimiento de la sesión en curso (FR-022).
 *
 * No recibe identificador a propósito: el ámbito sale de la sesión y la
 * política RLS deja exactamente una fila visible, así que el `select` sin
 * `where` sólo puede devolver la correcta.
 */
export async function obtenerMiParqueadero(
  contexto: Contexto,
): Promise<Parqueadero | null> {
  exigir(contexto, "parqueadero.ver.propio");

  if (contexto.tipo !== "establecimiento") return null;

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [propio] = await tx.select().from(parqueadero).limit(1);
    return propio ?? null;
  });
}
