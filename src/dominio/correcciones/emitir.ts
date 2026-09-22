import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import {
  correccion,
  delegacion,
  movimiento,
  type Correccion,
  type OperacionDelegable,
} from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export class CorreccionInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "CorreccionInvalida";
  }
}

function ambito(contexto: Contexto): string {
  if (contexto.tipo !== "establecimiento") {
    throw new CorreccionInvalida("Este contexto no pertenece a ningún establecimiento");
  }
  return contexto.parqueaderoId;
}

/**
 * Corrige un cobro ya cerrado.
 *
 * NO modifica el movimiento: escribe un asiento aparte que lo referencia. El
 * original queda intacto y los DOS importes se conservan —lo que se cobró y lo
 * que se debió cobrar—, porque reemplazar uno por otro destruiría la única
 * prueba de que hubo un error y de cuánto fue.
 *
 * La autorización la resuelve `exigir`: por rol la tiene el administrador, y un
 * operario sólo si un administrador se la delegó expresamente. Esa comprobación
 * vive en la puerta y no en la pantalla.
 */
export async function emitirCorreccion(
  contexto: Contexto,
  movimientoId: string,
  importeCorregido: number,
  motivo: string,
): Promise<Correccion> {
  exigir(contexto, "movimiento.corregir");
  const parqueaderoId = ambito(contexto);

  const razon = motivo.trim();
  if (razon.length === 0) {
    throw new CorreccionInvalida("Escriba qué se corrige y por qué");
  }
  if (!Number.isInteger(importeCorregido) || importeCorregido < 0) {
    throw new CorreccionInvalida("El importe corregido tiene que ser un número de pesos");
  }

  const [cerrado] = await conAmbito(parqueaderoId, (tx) =>
    tx
      .select({ id: movimiento.id, importe: movimiento.importe })
      .from(movimiento)
      .where(and(eq(movimiento.id, movimientoId), isNotNull(movimiento.salidaEn)))
      .limit(1),
  );

  if (!cerrado) throw await errorDeAlcance(contexto, `movimiento:${movimientoId}`);

  if (cerrado.importe === importeCorregido) {
    throw new CorreccionInvalida(
      "El importe corregido es el mismo que se cobró: no hay nada que corregir",
    );
  }

  return conAmbito(parqueaderoId, async (tx) => {
    const [emitida] = await tx
      .insert(correccion)
      .values({
        parqueaderoId,
        movimientoId,
        importeCorregido,
        motivo: razon,
        emitidaPor: contexto.usuarioId,
      })
      .returning();
    return emitida!;
  });
}

/** Las correcciones de un movimiento, de la más nueva a la más vieja. */
export async function correccionesDe(
  contexto: Contexto,
  movimientoId: string,
): Promise<Correccion[]> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select()
      .from(correccion)
      .where(eq(correccion.movimientoId, movimientoId))
      .orderBy(desc(correccion.emitidaEn)),
  );
}

/**
 * Autoriza a una persona concreta a ejecutar una operación que su rol no
 * incluye (constitución 1.1.0).
 *
 * NO la asciende: su rol sigue siendo el suyo. Y no puede alcanzar fuera del
 * establecimiento de quien la otorga, porque la política de ámbito de la tabla
 * lo impide sin que nadie tenga que comprobarlo.
 */
export async function otorgarDelegacion(
  contexto: Contexto,
  usuarioId: string,
  operacion: OperacionDelegable,
): Promise<void> {
  exigir(contexto, "delegacion.otorgar");
  const parqueaderoId = ambito(contexto);

  if (usuarioId === contexto.usuarioId) {
    throw new CorreccionInvalida("No hace falta delegarse un permiso a uno mismo");
  }

  await conAmbito(parqueaderoId, (tx) =>
    tx
      .insert(delegacion)
      .values({ parqueaderoId, usuarioId, operacion, otorgadaPor: contexto.usuarioId })
      // Volver a otorgar una delegación vigente no es un error ni crea una
      // segunda: es la misma autorización.
      .onConflictDoNothing(),
  );
}

/**
 * Revoca una delegación.
 *
 * Se MARCA, no se borra: revocar es un hecho que también se audita. Y las
 * correcciones ya emitidas se conservan, porque eran válidas cuando se
 * hicieron; lo que cambia es que no puede emitir más.
 */
export async function revocarDelegacion(
  contexto: Contexto,
  usuarioId: string,
  operacion: OperacionDelegable,
): Promise<void> {
  exigir(contexto, "delegacion.otorgar");
  const parqueaderoId = ambito(contexto);

  await conAmbito(parqueaderoId, (tx) =>
    tx
      .update(delegacion)
      .set({ revocadaEn: new Date() })
      .where(
        and(
          eq(delegacion.usuarioId, usuarioId),
          eq(delegacion.operacion, operacion),
          isNull(delegacion.revocadaEn),
        ),
      ),
  );
}

/** Quiénes tienen delegaciones vigentes, para la pantalla de operarios. */
export async function delegacionesVigentes(
  contexto: Contexto,
): Promise<Map<string, OperacionDelegable[]>> {
  exigir(contexto, "parqueadero.ver.propio");
  const porPersona = new Map<string, OperacionDelegable[]>();
  if (contexto.tipo !== "establecimiento") return porPersona;

  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ usuarioId: delegacion.usuarioId, operacion: delegacion.operacion })
      .from(delegacion)
      .where(isNull(delegacion.revocadaEn)),
  );

  for (const f of filas) {
    porPersona.set(f.usuarioId, [...(porPersona.get(f.usuarioId) ?? []), f.operacion]);
  }
  return porPersona;
}
