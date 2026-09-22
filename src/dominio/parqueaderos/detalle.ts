import { asc, eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, parqueadero, usuario } from "@/db/esquema";
import type { Parqueadero, RolUsuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { historialDeEstados, type AsientoHistorial } from "./historial-estado";
import { transicionesPosibles } from "./estados";

export type PersonaVinculada = {
  id: string;
  /** Identificador legible con la sigla del establecimiento, p. ej. `PCH-003`. */
  codigo: string | null;
  nombre: string;
  email: string;
  rol: RolUsuario;
  bloqueada: boolean;
  anonimizada: boolean;
  debeCambiarPassword: boolean;
  desde: Date;
};

export type DetalleParqueadero = {
  parqueadero: Parqueadero;
  administradores: PersonaVinculada[];
  operarios: PersonaVinculada[];
  historial: AsientoHistorial[];
  transicionesDisponibles: readonly string[];
};

/**
 * Ficha completa de un establecimiento, para el administrador general.
 *
 * Reúne todo lo que la plataforma sabe hoy: datos de contacto, su gente y el
 * historial de estados.
 *
 * Lo que todavía NO puede mostrar, porque el sistema no lo almacena: horarios
 * de atención, tarifas, convenios y capacidad. Todo eso pertenece a F2
 * (Configuración del establecimiento). La pantalla lo dice explícitamente en
 * lugar de omitirlo en silencio: un dato ausente sin explicación se lee como un
 * error del sistema.
 */
export async function obtenerDetalleParqueadero(
  contexto: Contexto,
  id: string,
): Promise<DetalleParqueadero | null> {
  exigir(contexto, "parqueadero.listar.todos");
  await registrarUsoPrivilegio(contexto, "parqueadero.ver_detalle");

  const datos = await comoPlataforma("administracion_plataforma", async (tx) => {
    const [encontrado] = await tx
      .select()
      .from(parqueadero)
      .where(eq(parqueadero.id, id))
      .limit(1);

    if (!encontrado) return null;

    const gente = await tx
      .select({
        id: usuario.id,
        codigo: usuario.codigo,
        nombre: usuario.name,
        email: usuario.email,
        rol: asignacion.rol,
        bloqueada: usuario.banned,
        anonimizadaEn: usuario.anonimizadaEn,
        debeCambiarPassword: usuario.debeCambiarPassword,
        desde: asignacion.creadaEn,
      })
      .from(asignacion)
      .innerJoin(usuario, eq(usuario.id, asignacion.usuarioId))
      .where(eq(asignacion.parqueaderoId, id))
      .orderBy(asc(asignacion.creadaEn));

    return { encontrado, gente };
  });

  if (!datos) return null;

  const personas: PersonaVinculada[] = datos.gente.map((g) => ({
    id: g.id,
    codigo: g.codigo,
    nombre: g.nombre,
    email: g.email,
    rol: g.rol,
    bloqueada: g.bloqueada,
    anonimizada: g.anonimizadaEn !== null,
    debeCambiarPassword: g.debeCambiarPassword,
    desde: g.desde,
  }));

  return {
    parqueadero: datos.encontrado,
    administradores: personas.filter((p) => p.rol === "admin_parqueadero"),
    operarios: personas.filter((p) => p.rol === "operario"),
    historial: await historialDeEstados(id),
    transicionesDisponibles: transicionesPosibles(datos.encontrado.estado),
  };
}
