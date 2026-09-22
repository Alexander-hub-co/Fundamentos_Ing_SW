import { and, desc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import {
  asignacion,
  cuenta,
  intentoLogin,
  parqueadero,
  sesion,
  usuario,
} from "@/db/esquema";
import type { EstadoParqueadero, RolUsuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";

/** Cuántos asientos de ingreso se traen a la ficha. */
export const INGRESOS_EN_FICHA = 10;

export type SesionActiva = {
  creadaEn: Date;
  expiraEn: Date;
  origen: string | null;
  navegador: string | null;
};

export type IngresoRegistrado = {
  ocurridoEn: Date;
  exito: boolean;
  origen: string | null;
  emailIntentado: string;
};

export type DetalleCuenta = {
  id: string;
  codigo: string | null;
  nombre: string;
  email: string;
  emailVerificado: boolean;
  rol: RolUsuario | null;
  bloqueada: boolean;
  motivoBloqueo: string | null;
  bloqueoExpira: Date | null;
  debeCambiarPassword: boolean;
  /** Fecha del borrado de datos personales, o null si conserva su identidad. */
  anonimizadaEn: Date | null;
  anonimizada: boolean;
  creadaEn: Date;
  actualizadaEn: Date;

  establecimiento: {
    id: string;
    nombre: string;
    codigo: string;
    estado: EstadoParqueadero;
    vinculadaDesde: Date;
  } | null;

  /**
   * Estado de la credencial, nunca la credencial.
   *
   * `tienePassword` se resuelve con un `IS NOT NULL` dentro de SQL: la columna
   * no viaja al servidor de aplicación ni por un instante. Ver la nota de
   * `obtenerDetalleCuenta` sobre por qué la contraseña no se puede mostrar.
   */
  credencial: {
    proveedor: string;
    tienePassword: boolean;
    definidaEn: Date;
    cambiadaEn: Date;
  } | null;

  sesionesActivas: SesionActiva[];
  ingresosRecientes: IngresoRegistrado[];
};

/**
 * Ficha completa de una cuenta, para el administrador general.
 *
 * SOBRE LA CONTRASEÑA. Esta función no devuelve la contraseña y no existe
 * ninguna otra que pueda hacerlo. Better Auth la guarda pasada por scrypt, una
 * función de una sola vía: de lo almacenado se puede comprobar si una
 * contraseña candidata coincide, pero no se puede recuperar la original. No es
 * una restricción que Parquivo eligió imponer y que podría levantar; es la
 * propiedad que hace que un volcado de la base de datos no entregue las
 * contraseñas de todos los operarios del país.
 *
 * Lo que la ficha sí muestra es todo lo que rodea a la credencial: si está
 * definida, cuándo se cambió por última vez, si es temporal y está pendiente de
 * cambio, desde qué equipos hay sesión abierta y cómo vienen saliendo los
 * intentos de ingreso. Cuando alguien olvida su contraseña, el camino es
 * restablecerla desde esta misma pantalla y entregarle la nueva.
 *
 * Se lee con privilegio de plataforma porque es exactamente su cometido:
 * mirar cuentas de todos los establecimientos. Por eso queda anotado en la
 * auditoría de uso de privilegio.
 */
export async function obtenerDetalleCuenta(
  contexto: Contexto,
  usuarioId: string,
): Promise<DetalleCuenta | null> {
  exigir(contexto, "cuenta.crear");
  await registrarUsoPrivilegio(contexto, "cuenta.ver_detalle");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const [fila] = await tx
      .select({
        id: usuario.id,
        codigo: usuario.codigo,
        nombre: usuario.name,
        email: usuario.email,
        emailVerificado: usuario.emailVerified,
        bloqueada: usuario.banned,
        motivoBloqueo: usuario.banReason,
        bloqueoExpira: usuario.banExpires,
        debeCambiarPassword: usuario.debeCambiarPassword,
        anonimizadaEn: usuario.anonimizadaEn,
        creadaEn: usuario.createdAt,
        actualizadaEn: usuario.updatedAt,

        rol: asignacion.rol,
        vinculadaDesde: asignacion.creadaEn,
        establecimientoId: parqueadero.id,
        establecimientoNombre: parqueadero.nombre,
        establecimientoCodigo: parqueadero.codigo,
        establecimientoEstado: parqueadero.estado,
      })
      .from(usuario)
      .leftJoin(asignacion, eq(asignacion.usuarioId, usuario.id))
      .leftJoin(parqueadero, eq(parqueadero.id, asignacion.parqueaderoId))
      .where(eq(usuario.id, usuarioId))
      .limit(1);

    if (!fila) return null;

    // La columna `password` no se selecciona: sólo si es nula o no.
    const [credencial] = await tx
      .select({
        proveedor: cuenta.providerId,
        tienePassword: sql<boolean>`${cuenta.password} is not null`,
        definidaEn: cuenta.createdAt,
        cambiadaEn: cuenta.updatedAt,
      })
      .from(cuenta)
      .where(and(eq(cuenta.userId, usuarioId), eq(cuenta.providerId, "credential")))
      .limit(1);

    const sesiones = await tx
      .select({
        creadaEn: sesion.createdAt,
        expiraEn: sesion.expiresAt,
        origen: sesion.ipAddress,
        navegador: sesion.userAgent,
      })
      .from(sesion)
      .where(and(eq(sesion.userId, usuarioId), gt(sesion.expiresAt, new Date())))
      .orderBy(desc(sesion.createdAt));

    // Los intentos fallidos no siempre traen usuarioId —si el correo existe
    // pero la contraseña no, todavía no hay usuario resuelto—, así que se
    // buscan también por el correo.
    const ingresos = await tx
      .select({
        ocurridoEn: intentoLogin.ocurridoEn,
        exito: intentoLogin.exito,
        origen: intentoLogin.origen,
        emailIntentado: intentoLogin.emailIntentado,
      })
      .from(intentoLogin)
      .where(
        or(
          and(isNotNull(intentoLogin.usuarioId), eq(intentoLogin.usuarioId, usuarioId)),
          eq(intentoLogin.emailIntentado, fila.email),
        ),
      )
      .orderBy(desc(intentoLogin.ocurridoEn))
      .limit(INGRESOS_EN_FICHA);

    return {
      id: fila.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      email: fila.email,
      emailVerificado: fila.emailVerificado,
      rol: fila.rol,
      bloqueada: fila.bloqueada,
      motivoBloqueo: fila.motivoBloqueo,
      bloqueoExpira: fila.bloqueoExpira,
      debeCambiarPassword: fila.debeCambiarPassword,
      anonimizadaEn: fila.anonimizadaEn,
      anonimizada: fila.anonimizadaEn !== null,
      creadaEn: fila.creadaEn,
      actualizadaEn: fila.actualizadaEn,
      establecimiento: fila.establecimientoId
        ? {
            id: fila.establecimientoId,
            nombre: fila.establecimientoNombre!,
            codigo: fila.establecimientoCodigo!,
            estado: fila.establecimientoEstado!,
            vinculadaDesde: fila.vinculadaDesde!,
          }
        : null,
      credencial: credencial ?? null,
      sesionesActivas: sesiones,
      ingresosRecientes: ingresos,
    };
  });
}
