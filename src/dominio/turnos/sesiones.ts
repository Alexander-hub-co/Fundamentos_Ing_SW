import { and, asc, eq, isNull } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { sesionTurno, turno, turnoDia, type SesionTurno } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

export class SesionInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "SesionInvalida";
  }
}

/**
 * A qué sesión atribuir un movimiento.
 *
 * Devuelve nulo SIN ERROR cuando no hay ninguna abierta. Es deliberado: la
 * ausencia de sesión no puede impedir operar, porque entonces un olvido
 * administrativo dejaría vehículos afuera esperando a que alguien abra su turno.
 */
export async function sesionAbiertaDe(
  contexto: Contexto,
  usuarioId: string,
): Promise<SesionTurno | null> {
  if (contexto.tipo !== "establecimiento") return null;

  const [abierta] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select()
      .from(sesionTurno)
      .where(and(eq(sesionTurno.abiertaPor, usuarioId), isNull(sesionTurno.cerradaEn)))
      .limit(1),
  );

  return abierta ?? null;
}

/**
 * Abre una sesión de turno.
 *
 * Copia las horas programadas del turno en vez de leerlas de él después: si
 * mañana se cambia el horario del turno, esta sesión debe seguir diciendo a qué
 * hora se suponía que empezaba cuando ocurrió.
 */
export async function abrirSesion(
  contexto: Contexto,
  turnoId: string,
  ahora: Date,
): Promise<SesionTurno> {
  exigir(contexto, "turno.abrir");
  if (contexto.tipo !== "establecimiento") {
    throw new SesionInvalida("Este contexto no pertenece a ningún establecimiento");
  }

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [declarado] = await tx.select().from(turno).where(eq(turno.id, turnoId)).limit(1);
    if (!declarado) throw new SesionInvalida("Ese turno no existe en este establecimiento");
    if (!declarado.activo) throw new SesionInvalida("Ese turno está desactivado");

    const [abierta] = await tx
      .select({ id: sesionTurno.id })
      .from(sesionTurno)
      .where(and(eq(sesionTurno.abiertaPor, contexto.usuarioId), isNull(sesionTurno.cerradaEn)))
      .limit(1);

    if (abierta) {
      throw new SesionInvalida("Ya tiene un turno abierto. Ciérrelo antes de abrir otro");
    }

    const [creada] = await tx
      .insert(sesionTurno)
      .values({
        parqueaderoId: contexto.parqueaderoId,
        turnoId,
        abiertaPor: contexto.usuarioId,
        abiertaEn: ahora,
        programadaInicio: declarado.horaInicio,
        programadaFin: declarado.horaFin,
      })
      .returning();

    return creada!;
  });
}

/**
 * Cierra una sesión.
 *
 * SE PERMITE aunque queden vehículos adentro: son del establecimiento, no del
 * turno. Los cierra quien esté en la taquilla cuando salgan, que puede ser otra
 * persona en otro turno.
 */
export async function cerrarSesion(
  contexto: Contexto,
  sesionId: string,
  ahora: Date,
): Promise<SesionTurno> {
  exigir(contexto, "turno.abrir");
  if (contexto.tipo !== "establecimiento") {
    throw new SesionInvalida("Este contexto no pertenece a ningún establecimiento");
  }

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [cerrada] = await tx
      .update(sesionTurno)
      .set({ cerradaEn: ahora })
      .where(and(eq(sesionTurno.id, sesionId), isNull(sesionTurno.cerradaEn)))
      .returning();

    if (!cerrada) throw new SesionInvalida("Esa sesión no está abierta");
    return cerrada;
  });
}

/**
 * Los turnos que se pueden abrir hoy, con su horario.
 *
 * Se filtran por el día de la semana declarado: ofrecer el turno del domingo un
 * martes sólo invita a abrir el equivocado. Se filtran también por activo,
 * porque `abrirSesion` los rechaza y es mejor no ofrecerlos.
 */
export async function turnosAbribles(
  contexto: Contexto,
  ahora: Date,
): Promise<{ id: string; nombre: string; horaInicio: string; horaFin: string }[]> {
  if (contexto.tipo !== "establecimiento") return [];

  // El día de la semana en la zona del establecimiento, no en la del servidor.
  const diaSemana = new Date(
    ahora.toLocaleString("en-US", { timeZone: "America/Bogota" }),
  ).getDay();

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .selectDistinct({
        id: turno.id,
        nombre: turno.nombre,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
      })
      .from(turno)
      .innerJoin(turnoDia, eq(turnoDia.turnoId, turno.id))
      .where(and(eq(turno.activo, true), eq(turnoDia.diaSemana, diaSemana)))
      .orderBy(asc(turno.horaInicio)),
  );
}

/** La sesión abierta con el nombre de su turno, para el panel de la taquilla. */
export async function sesionAbiertaConTurno(
  contexto: Contexto,
  usuarioId: string,
): Promise<{
  id: string;
  turnoNombre: string;
  abiertaEn: Date;
  programadaInicio: string;
  programadaFin: string;
} | null> {
  if (contexto.tipo !== "establecimiento") return null;

  const [fila] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({
        id: sesionTurno.id,
        turnoNombre: turno.nombre,
        abiertaEn: sesionTurno.abiertaEn,
        programadaInicio: sesionTurno.programadaInicio,
        programadaFin: sesionTurno.programadaFin,
      })
      .from(sesionTurno)
      .innerJoin(turno, eq(turno.id, sesionTurno.turnoId))
      .where(and(eq(sesionTurno.abiertaPor, usuarioId), isNull(sesionTurno.cerradaEn)))
      .limit(1),
  );

  return fila ?? null;
}
