import { lt, eq, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import {
  accesoDenegado,
  intentoLogin,
  mantenimiento,
  HORAS_ENTRE_PURGAS,
  RETENCION_MESES,
} from "@/db/esquema";

/**
 * Purga de registros de auditoría vencidos (FR-047).
 *
 * `intento_login` y `acceso_denegado` guardan datos personales —correos y
 * referencias a cuentas— y sin una retención definida los conservarían para
 * siempre. Doce meses alcanzan para investigar un incidente y evitan acumular
 * indefinidamente información de personas.
 *
 * No se purga `cambio_estado` ni `uso_privilegio`: el primero es la constancia
 * comercial de por qué se le cortó el servicio a un cliente, y el segundo la
 * traza de quién ejerció el privilegio global. Ambos pertenecen al historial
 * que el Principio IV protege.
 */

export type ResultadoPurga = {
  intentosEliminados: number;
  accesosDenegadosEliminados: number;
  /**
   * Movimientos a los que se les vació la cédula, el teléfono y la seña de la
   * bicicleta. **No borrados**: la fila y su cobro se conservan.
   */
  movimientosAnonimizados: number;
  corteEn: Date;
};

export function fechaDeCorte(ahora: Date = new Date()): Date {
  const corte = new Date(ahora);
  corte.setMonth(corte.getMonth() - RETENCION_MESES);
  return corte;
}

export async function purgarAuditoriaVencida(
  ahora: Date = new Date(),
): Promise<ResultadoPurga> {
  const corte = fechaDeCorte(ahora);

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const intentos = await tx
      .delete(intentoLogin)
      .where(lt(intentoLogin.ocurridoEn, corte))
      .returning({ id: intentoLogin.id });

    const accesos = await tx
      .delete(accesoDenegado)
      .where(lt(accesoDenegado.ocurridoEn, corte))
      .returning({ id: accesoDenegado.id });

    /**
     * Los datos de quien dejó una bicicleta (F4): nombre, cédula, teléfono y
     * la seña del vehículo.
     *
     * Aquí se VACÍAN columnas en vez de borrar filas, y la diferencia es de
     * fondo: `intento_login` y `acceso_denegado` son auditoría y la fila entera
     * pierde sentido pasado el plazo. Un movimiento es CONTABILIDAD —el
     * Principio IV lo protege y los reportes lo necesitan—, así que se conserva
     * y lo que se va es lo que identifica a una persona.
     *
     * La seña de la bicicleta entra en la purga aunque parezca inocua: "negra,
     * marca Trek, calcomanía de la universidad" describe a alguien tanto como
     * su teléfono.
     *
     * Sólo movimientos CERRADOS: uno abierto todavía necesita la cédula, porque
     * es la vía para devolver la bicicleta si se perdió el tarjetón.
     */
    const anonimizados = await tx.execute<{ n: number }>(sql`
      update movimiento
         set nombre = null, cedula = null, telefono = null, nota_vehiculo = null
       where salida_en is not null
         and salida_en < ${corte}
         and (nombre is not null or cedula is not null or telefono is not null
              or nota_vehiculo is not null)
      returning 1 as n
    `);

    return {
      intentosEliminados: intentos.length,
      accesosDenegadosEliminados: accesos.length,
      movimientosAnonimizados: anonimizados.rows.length,
      corteEn: corte,
    };
  });
}

/** Cuántos registros quedarían fuera de la retención en este momento. */
export async function registrosVencidos(ahora: Date = new Date()) {
  const corte = fechaDeCorte(ahora);
  return comoPlataforma("administracion_plataforma", async (tx) => {
    const r = await tx.execute(sql`
      select
        (select count(*)::int from ${intentoLogin} where ocurrido_en < ${corte}) as intentos,
        (select count(*)::int from ${accesoDenegado} where ocurrido_en < ${corte}) as accesos,
        (select count(*)::int from movimiento
          where salida_en is not null and salida_en < ${corte}
            and (nombre is not null or cedula is not null or telefono is not null
              or nota_vehiculo is not null)
        ) as movimientos
    `);
    return r.rows[0] as { intentos: number; accesos: number; movimientos: number };
  });
}

/**
 * Purga automática de la auditoría vencida (FR-047).
 *
 * FR-047 pide que los registros "se eliminen automáticamente" a los 12 meses.
 * Existía la función que borra, pero nadie la invocaba, así que en la práctica
 * no se eliminaba nada nunca.
 *
 * DECISIÓN Y SU COSTO. Parquivo no tiene todavía un planificador de tareas, y
 * añadir uno para una operación que corre una vez al día es desproporcionado en
 * esta etapa. La purga se comprueba entonces al entrar al panel de plataforma:
 * si pasaron más de `HORAS_ENTRE_PURGAS` desde la última, se ejecuta.
 *
 * El costo hay que decirlo con claridad: si nadie entra al panel durante meses,
 * la purga no ocurre y los registros sobreviven a su retención. Para una
 * plataforma que su dueño administra a diario es aceptable; cuando haya
 * despliegue con planificador —cron del sistema o del proveedor— lo correcto es
 * llamar a `purgarAuditoriaVencida()` desde ahí y borrar esta comprobación.
 *
 * Nunca lanza: la retención no debe poder tumbar el panel. Un fallo se anota y
 * se reintenta a la siguiente entrada.
 */
export async function purgarSiCorresponde(
  ahora: Date = new Date(),
): Promise<ResultadoPurga | null> {
  try {
    return await comoPlataforma("administracion_plataforma", async (tx) => {
      // Cerrojo no bloqueante: si otra instancia ya está purgando, esta se va
      // sin esperar en vez de encolar una purga redundante.
      const cerrojo = await tx.execute<{ tomado: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext('purga_auditoria')) as tomado`,
      );
      if (!(cerrojo.rows[0] as { tomado: boolean } | undefined)?.tomado) return null;

      const [marca] = await tx
        .select({ ejecutadoEn: mantenimiento.ejecutadoEn })
        .from(mantenimiento)
        .where(eq(mantenimiento.clave, CLAVE_PURGA))
        .limit(1);

      if (marca) {
        const horas = (ahora.getTime() - marca.ejecutadoEn.getTime()) / 3_600_000;
        if (horas < HORAS_ENTRE_PURGAS) return null;
      }

      const corte = fechaDeCorte(ahora);

      const intentos = await tx
        .delete(intentoLogin)
        .where(lt(intentoLogin.ocurridoEn, corte))
        .returning({ id: intentoLogin.id });

      const accesos = await tx
        .delete(accesoDenegado)
        .where(lt(accesoDenegado.ocurridoEn, corte))
        .returning({ id: accesoDenegado.id });

      // Los datos personales de las bicicletas. Mismo criterio que arriba: se
      // vacían columnas, no se borran filas, porque un movimiento es
      // contabilidad y no auditoría.
      const anonimizados = await tx.execute<{ n: number }>(sql`
        update movimiento
           set nombre = null, cedula = null, telefono = null, nota_vehiculo = null
         where salida_en is not null
           and salida_en < ${corte}
           and (nombre is not null or cedula is not null or telefono is not null
              or nota_vehiculo is not null)
        returning 1 as n
      `);

      await tx
        .insert(mantenimiento)
        .values({ clave: CLAVE_PURGA, ejecutadoEn: ahora })
        .onConflictDoUpdate({
          target: mantenimiento.clave,
          set: { ejecutadoEn: ahora },
        });

      return {
        intentosEliminados: intentos.length,
        accesosDenegadosEliminados: accesos.length,
        movimientosAnonimizados: anonimizados.rows.length,
        corteEn: corte,
      };
    });
  } catch (error) {
    console.error("[retención] no se pudo purgar la auditoría vencida", error);
    return null;
  }
}

const CLAVE_PURGA = "purga_auditoria";
