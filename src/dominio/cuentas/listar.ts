import { asc, eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import type { RolUsuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

export type CuentaListada = {
  id: string;
  /** Código legible, `PCH-001`. Nulo sólo si la migración no lo alcanzó. */
  codigo: string | null;
  nombre: string;
  email: string;
  bloqueada: boolean;
  anonimizada: boolean;
  debeCambiarPassword: boolean;
  rol: RolUsuario | null;
  establecimiento: string | null;
  /** Necesario para agrupar el listado por establecimiento. */
  establecimientoId: string | null;
};

/** Listado de cuentas para el administrador general. */
export async function listarCuentas(contexto: Contexto): Promise<CuentaListada[]> {
  exigir(contexto, "cuenta.crear");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const filas = await tx
      .select({
        id: usuario.id,
        codigo: usuario.codigo,
        nombre: usuario.name,
        email: usuario.email,
        bloqueada: usuario.banned,
        anonimizadaEn: usuario.anonimizadaEn,
        debeCambiarPassword: usuario.debeCambiarPassword,
        rol: asignacion.rol,
        establecimiento: parqueadero.nombre,
        establecimientoId: parqueadero.id,
      })
      .from(usuario)
      .leftJoin(asignacion, eq(asignacion.usuarioId, usuario.id))
      .leftJoin(parqueadero, eq(parqueadero.id, asignacion.parqueaderoId))
      .orderBy(asc(usuario.codigo), asc(usuario.name));

    return filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      email: f.email,
      bloqueada: f.bloqueada,
      anonimizada: f.anonimizadaEn !== null,
      debeCambiarPassword: f.debeCambiarPassword,
      rol: f.rol,
      establecimiento: f.establecimiento,
      establecimientoId: f.establecimientoId,
    }));
  });
}
