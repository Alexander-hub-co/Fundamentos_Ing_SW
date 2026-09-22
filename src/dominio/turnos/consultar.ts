import { asc, eq } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { turno, turnoAsignacion, turnoDia, usuario } from "@/db/esquema";
import { expandirHorario, type ReglaHoraria } from "@/dominio/calendario/expandir";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/** Un turno con sus días y su gente, tal como lo muestra el calendario. */
export type TurnoCompleto = {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
  dias: number[];
  personas: { id: string; nombre: string; codigo: string | null }[];
};

/**
 * Qué turno rige en un instante, y quién debería estar atendiendo.
 *
 * PURO: recibe los turnos como dato. Se apoya en la misma expansión a instantes
 * absolutos que el cobro, así que un turno nocturno de 22:00 a 06:00 no
 * necesita ningún caso especial: a las 02:00 del martes el vigente es el que
 * arrancó el lunes.
 *
 * Devuelve una lista y no uno solo: dos turnos pueden solaparse a propósito
 * —dos personas cubriendo la hora pico— y eso es configuración legítima, no un
 * error que el sistema deba impedir.
 */
export function turnosVigentesEn(
  turnos: readonly TurnoCompleto[],
  momento: Date,
): TurnoCompleto[] {
  return turnos.filter((t) => {
    if (!t.activo) return false;

    const reglas: ReglaHoraria[] = t.dias.map((diaSemana) => ({
      diaSemana,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
    }));

    const ventanas = expandirHorario(reglas, momento, new Date(momento.getTime() + 60_000));
    return ventanas.some((v) => v.desde <= momento && momento < v.hasta);
  });
}

/** Los turnos del establecimiento, con sus días y su gente. */
export async function turnosDelEstablecimiento(
  contexto: Contexto,
): Promise<TurnoCompleto[]> {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const filas = await tx.select().from(turno).orderBy(asc(turno.horaInicio));
    const dias = await tx.select().from(turnoDia);
    const gente = await tx
      .select({
        turnoId: turnoAsignacion.turnoId,
        id: usuario.id,
        nombre: usuario.name,
        codigo: usuario.codigo,
      })
      .from(turnoAsignacion)
      .innerJoin(usuario, eq(usuario.id, turnoAsignacion.usuarioId));

    return filas.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      activo: t.activo,
      dias: dias.filter((d) => d.turnoId === t.id).map((d) => d.diaSemana).sort(),
      personas: gente
        .filter((g) => g.turnoId === t.id)
        .map(({ id, nombre, codigo }) => ({ id, nombre, codigo })),
    }));
  });
}
