import { and, eq, isNull } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, delegacion, parqueadero, usuario } from "@/db/esquema";
import type { EstadoParqueadero, OperacionDelegable, RolUsuario } from "@/db/esquema";
import { auth } from "./auth";

/**
 * Resolución del ámbito de trabajo a partir de la sesión autenticada.
 *
 * FR-009 es tajante: el establecimiento activo se resuelve desde la sesión y
 * NUNCA desde un valor que el cliente pueda enviar o modificar. Por eso ninguna
 * función de este módulo acepta un identificador de parqueadero como parámetro.
 * Si mañana alguien añade ese parámetro, está introduciendo la vulnerabilidad
 * que todo el diseño existe para evitar.
 */

export type Contexto =
  | {
      tipo: "plataforma";
      usuarioId: string;
      rol: "admin_general";
    }
  | {
      tipo: "establecimiento";
      usuarioId: string;
      rol: "admin_parqueadero" | "operario";
      parqueaderoId: string;
      /**
       * El estado viaja en el contexto a propósito.
       *
       * La alternativa era pasarlo como opción a cada llamada de autorización,
       * y eso hace que el modo restringido dependa de que quien llama se
       * acuerde. Acá se resuelve una vez, al construir el contexto, y toda
       * decisión posterior lo tiene disponible sin poder olvidarlo.
       */
      estado: EstadoParqueadero;
      /**
       * Operaciones que un administrador le autorizó a ESTA persona, más allá
       * de las de su rol (constitución 1.1.0).
       *
       * Viaja en el contexto por la misma razón que el estado: se resuelve una
       * vez, al construirlo, y ninguna decisión posterior puede olvidarlo. La
       * alternativa era consultar la base en cada comprobación de permiso, lo
       * que obligaría a volver asíncrona toda la autorización.
       *
       * Opcional, y su ausencia significa NINGUNA. Falla del lado seguro: un
       * contexto armado a mano sin delegaciones deniega, no concede.
       */
      delegaciones?: readonly OperacionDelegable[];
    };

export class SinSesion extends Error {
  constructor() {
    super("No hay sesión autenticada");
    this.name = "SinSesion";
  }
}

export class SinAmbito extends Error {
  constructor() {
    super("La cuenta no tiene asignación a ningún establecimiento");
    this.name = "SinAmbito";
  }
}

export class DebeCambiarPassword extends Error {
  constructor(readonly usuarioId: string) {
    super("La cuenta debe cambiar su contraseña antes de continuar");
    this.name = "DebeCambiarPassword";
  }
}

export class CuentaInhabilitada extends Error {
  constructor(motivo: "bloqueada" | "anonimizada") {
    super(`La cuenta está ${motivo}`);
    this.name = "CuentaInhabilitada";
  }
}

/**
 * Devuelve el contexto de la petición en curso.
 *
 * Lanza en lugar de devolver null: un fallo al resolver el ámbito debe cortar
 * la operación, no continuar con un valor vacío que las políticas interpreten
 * como "sin ámbito" y que un `catch` descuidado pueda ignorar.
 */
export async function contextoActual(cabeceras: Headers): Promise<Contexto> {
  const sesion = await auth.api.getSession({ headers: cabeceras });
  if (!sesion) throw new SinSesion();

  return comoPlataforma("autenticacion", async (tx) => {
    const [cuenta] = await tx
      .select({
        banned: usuario.banned,
        anonimizadaEn: usuario.anonimizadaEn,
        debeCambiarPassword: usuario.debeCambiarPassword,
      })
      .from(usuario)
      .where(eq(usuario.id, sesion.user.id))
      .limit(1);

    if (!cuenta) throw new SinSesion();
    if (cuenta.anonimizadaEn) throw new CuentaInhabilitada("anonimizada");
    if (cuenta.banned) throw new CuentaInhabilitada("bloqueada");

    // FR-033: hasta que cambie la contraseña temporal, ninguna otra
    // funcionalidad es accesible. Se corta acá, en la resolución del contexto,
    // y no en cada pantalla: así no depende de que alguien se acuerde.
    if (cuenta.debeCambiarPassword) throw new DebeCambiarPassword(sesion.user.id);

    const [vinculo] = await tx
      .select({
        rol: asignacion.rol,
        parqueaderoId: asignacion.parqueaderoId,
        estado: parqueadero.estado,
      })
      .from(asignacion)
      .leftJoin(parqueadero, eq(parqueadero.id, asignacion.parqueaderoId))
      .where(eq(asignacion.usuarioId, sesion.user.id))
      .limit(1);

    // Escenario 3 de la historia 2: un usuario sin asignación no alcanza
    // ningún recurso operativo.
    if (!vinculo) throw new SinAmbito();

    if (vinculo.rol === "admin_general") {
      return {
        tipo: "plataforma",
        usuarioId: sesion.user.id,
        rol: "admin_general",
      } satisfies Contexto;
    }

    // La restricción CHECK de la tabla garantiza que aquí siempre hay ámbito;
    // la comprobación queda igualmente porque el tipo no lo sabe.
    if (!vinculo.parqueaderoId || !vinculo.estado) throw new SinAmbito();

    // Una consulta por petición, no una por comprobación de permiso.
    const otorgadas = await tx
      .select({ operacion: delegacion.operacion })
      .from(delegacion)
      .where(
        and(
          eq(delegacion.usuarioId, sesion.user.id),
          eq(delegacion.parqueaderoId, vinculo.parqueaderoId),
          isNull(delegacion.revocadaEn),
        ),
      );

    return {
      tipo: "establecimiento",
      usuarioId: sesion.user.id,
      rol: vinculo.rol as Exclude<RolUsuario, "admin_general">,
      parqueaderoId: vinculo.parqueaderoId,
      estado: vinculo.estado as EstadoParqueadero,
      delegaciones: otorgadas.map((d) => d.operacion),
    } satisfies Contexto;
  });
}
