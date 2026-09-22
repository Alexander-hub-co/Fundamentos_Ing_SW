import { expandirHorario, type ReglaHoraria, type Ventana } from "@/dominio/calendario/expandir";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";
import type { TurnoCompleto } from "./consultar";

/**
 * Horas de atención que ningún turno activo cubre.
 *
 * Es un AVISO, no un impedimento (FR de la clarificación): se puede declarar el
 * horario antes de organizar al equipo, y hay que poder guardar una
 * configuración a medias. Impedirlo obligaría a hacer las dos cosas de una
 * sentada, que es justo lo contrario de lo que necesita alguien configurando su
 * local por primera vez.
 *
 * Al revés no se avisa: un turno que se extiende fuera del horario es normal
 * —alguien entra media hora antes a abrir y contar la caja— y no es un error.
 *
 * Puro: recibe todo como dato.
 */
export function horasSinCubrir(
  horario: HorarioDelCobro,
  turnos: readonly TurnoCompleto[],
  desde: Date,
  hasta: Date,
): Ventana[] {
  // Un establecimiento de 24 horas no declara franjas, así que no hay contra
  // qué comparar sin inventar una jornada. No se avisa nada.
  if (horario.abierto24h) return [];

  const atencion = expandirHorario(horario.franjas, desde, hasta);

  const cubiertas = turnos
    .filter((t) => t.activo && t.personas.length > 0)
    .flatMap((t) =>
      expandirHorario(
        t.dias.map((diaSemana) => ({
          diaSemana,
          horaInicio: t.horaInicio,
          horaFin: t.horaFin,
        })) satisfies ReglaHoraria[],
        desde,
        hasta,
      ),
    )
    .sort((a, b) => a.desde.getTime() - b.desde.getTime());

  const huecos: Ventana[] = [];

  for (const ventana of atencion) {
    let cursor = ventana.desde;

    for (const c of cubiertas) {
      if (c.hasta <= cursor) continue;
      if (c.desde >= ventana.hasta) break;
      if (c.desde > cursor) huecos.push({ desde: cursor, hasta: c.desde });
      if (c.hasta > cursor) cursor = c.hasta;
      if (cursor >= ventana.hasta) break;
    }

    if (cursor < ventana.hasta) huecos.push({ desde: cursor, hasta: ventana.hasta });
  }

  return huecos;
}
