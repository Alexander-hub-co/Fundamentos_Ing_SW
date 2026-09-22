import { and, eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, usuario } from "@/db/esquema";
import type { RolUsuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

export class CuentaYaAsignada extends Error {
  constructor() {
    super(
      "La cuenta ya pertenece a otro establecimiento. Una cuenta sólo puede " +
        "estar asignada a uno (FR-020).",
    );
    this.name = "CuentaYaAsignada";
  }
}

export class CuentaInexistente extends Error {
  constructor() {
    super("La cuenta no existe");
    this.name = "CuentaInexistente";
  }
}

export class SinResponsable extends Error {
  constructor() {
    super(
      "El establecimiento quedaría sin ninguna persona administradora (FR-037)",
    );
    this.name = "SinResponsable";
  }
}

export type RolDeEstablecimiento = Exclude<RolUsuario, "admin_general">;

/**
 * Vincula una cuenta a un establecimiento con un rol (FR-018).
 *
 * La restricción de unicidad de la base ya impediría el doble vínculo, pero se
 * comprueba antes para devolver un error con significado en vez de un fallo de
 * integridad.
 */
export async function asignarAdministrador(
  contexto: Contexto,
  datos: {
    usuarioId: string;
    parqueaderoId: string;
    rol: RolDeEstablecimiento;
  },
) {
  exigir(contexto, "parqueadero.asignar_administrador");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [cuenta] = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(eq(usuario.id, datos.usuarioId))
      .limit(1);
    if (!cuenta) throw new CuentaInexistente();

    const [vinculoPrevio] = await tx
      .select({ id: asignacion.id })
      .from(asignacion)
      .where(eq(asignacion.usuarioId, datos.usuarioId))
      .limit(1);
    if (vinculoPrevio) throw new CuentaYaAsignada();

    const [creada] = await tx
      .insert(asignacion)
      .values({
        usuarioId: datos.usuarioId,
        parqueaderoId: datos.parqueaderoId,
        rol: datos.rol,
      })
      .returning();

    return creada!;
  });
}

/**
 * Retira el vínculo de una cuenta con su establecimiento.
 *
 * Protege al último administrador: retirar su asignación deja al
 * establecimiento sin responsable, que es la misma situación que FR-037 exige
 * advertir al bloquearlo o darlo de baja. Sin `confirmado`, se rechaza.
 */
export async function retirarAdministrador(
  contexto: Contexto,
  datos: { usuarioId: string; confirmado?: boolean },
) {
  exigir(contexto, "parqueadero.asignar_administrador");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [vinculo] = await tx
      .select({
        parqueaderoId: asignacion.parqueaderoId,
        rol: asignacion.rol,
      })
      .from(asignacion)
      .where(eq(asignacion.usuarioId, datos.usuarioId))
      .limit(1);

    if (!vinculo || !vinculo.parqueaderoId) throw new CuentaInexistente();

    if (vinculo.rol === "admin_parqueadero" && !datos.confirmado) {
      const restantes = await tx
        .select({ id: asignacion.id })
        .from(asignacion)
        .where(
          and(
            eq(asignacion.parqueaderoId, vinculo.parqueaderoId),
            eq(asignacion.rol, "admin_parqueadero"),
          ),
        );

      if (restantes.length <= 1) throw new SinResponsable();
    }

    await tx.delete(asignacion).where(eq(asignacion.usuarioId, datos.usuarioId));
  });
}
