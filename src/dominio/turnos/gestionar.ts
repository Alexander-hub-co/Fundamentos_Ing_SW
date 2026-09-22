import { and, eq } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { asignacion, turno, turnoAsignacion, turnoDia, type Turno } from "@/db/esquema";
import { minutosDelDia } from "@/dominio/calendario/expandir";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

export class TurnoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "TurnoInvalido";
  }
}

export type DatosTurno = {
  nombre: string;
  horaInicio: string;
  horaFin: string;
  dias: number[];
};

function validar(datos: DatosTurno): void {
  if (datos.nombre.trim().length === 0) {
    throw new TurnoInvalido("El turno necesita un nombre");
  }
  if (minutosDelDia(datos.horaInicio) === minutosDelDia(datos.horaFin)) {
    throw new TurnoInvalido(
      "La hora de fin no puede ser igual a la de inicio: no expresa ninguna duración",
    );
  }
  if (datos.dias.length === 0) {
    throw new TurnoInvalido("Elija al menos un día de la semana");
  }
  if (datos.dias.some((d) => d < 0 || d > 6)) {
    throw new TurnoInvalido("Día de la semana inválido");
  }
}

function exigirEstablecimiento(contexto: Contexto): string {
  if (contexto.tipo !== "establecimiento") {
    throw new TurnoInvalido("El contexto no pertenece a ningún establecimiento");
  }
  return contexto.parqueaderoId;
}

/** Crea un turno con sus días (FR-034 a FR-039). */
export async function crearTurno(contexto: Contexto, datos: DatosTurno): Promise<Turno> {
  exigir(contexto, "parqueadero.editar.propio");
  validar(datos);
  const parqueaderoId = exigirEstablecimiento(contexto);

  return conAmbito(parqueaderoId, async (tx) => {
    const [creado] = await tx
      .insert(turno)
      .values({
        parqueaderoId,
        nombre: datos.nombre.trim(),
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
      })
      .returning();

    await tx.insert(turnoDia).values(
      datos.dias.map((diaSemana) => ({ turnoId: creado!.id, parqueaderoId, diaSemana })),
    );

    return creado!;
  });
}

/** Edita un turno. Los días se reemplazan enteros, no se acumulan. */
export async function editarTurno(
  contexto: Contexto,
  turnoId: string,
  datos: DatosTurno,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  validar(datos);
  const parqueaderoId = exigirEstablecimiento(contexto);

  await conAmbito(parqueaderoId, async (tx) => {
    await tx
      .update(turno)
      .set({
        nombre: datos.nombre.trim(),
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
      })
      .where(eq(turno.id, turnoId));

    await tx.delete(turnoDia).where(eq(turnoDia.turnoId, turnoId));
    await tx.insert(turnoDia).values(
      datos.dias.map((diaSemana) => ({ turnoId, parqueaderoId, diaSemana })),
    );
  });
}

/**
 * Activa o desactiva un turno.
 *
 * NO hay borrado. Los movimientos que F3 registre bajo un turno tienen que
 * seguir siendo explicables después (Principio IV): un turno borrado dejaría
 * asientos apuntando a la nada.
 */
export async function cambiarEstadoTurno(
  contexto: Contexto,
  turnoId: string,
  activo: boolean,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = exigirEstablecimiento(contexto);

  await conAmbito(parqueaderoId, (tx) =>
    tx.update(turno).set({ activo }).where(eq(turno.id, turnoId)),
  );
}

/**
 * Asigna una persona a un turno (FR-040 a FR-042).
 *
 * Acepta administradores además de operarios: en muchos parqueaderos el
 * administrador atiende la taquilla, y los roles acumulan en vez de ser
 * compartimentos.
 *
 * La pertenencia al establecimiento se comprueba acá y no con una clave
 * foránea: esa relación vive en `asignacion`, y una foránea compuesta obligaría
 * a duplicar el rol en esta tabla.
 */
export async function asignarATurno(
  contexto: Contexto,
  turnoId: string,
  usuarioId: string,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = exigirEstablecimiento(contexto);

  await conAmbito(parqueaderoId, async (tx) => {
    const [vinculo] = await tx
      .select({ id: asignacion.id })
      .from(asignacion)
      .where(eq(asignacion.usuarioId, usuarioId))
      .limit(1);

    // Con RLS puesta, una cuenta de otro establecimiento no aparece: la
    // ausencia significa "no es de acá", que es justo lo que hay que rechazar.
    if (!vinculo) {
      throw new TurnoInvalido("Esa persona no pertenece a este establecimiento");
    }

    await tx
      .insert(turnoAsignacion)
      .values({ turnoId, usuarioId, parqueaderoId })
      .onConflictDoNothing();
  });
}

export async function retirarDeTurno(
  contexto: Contexto,
  turnoId: string,
  usuarioId: string,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = exigirEstablecimiento(contexto);

  await conAmbito(parqueaderoId, (tx) =>
    tx
      .delete(turnoAsignacion)
      .where(
        and(
          eq(turnoAsignacion.turnoId, turnoId),
          eq(turnoAsignacion.usuarioId, usuarioId),
        ),
      ),
  );
}
