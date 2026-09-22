import { eq } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { horarioAtencion, horarioFranja } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";
import { expandirHorario } from "@/dominio/calendario/expandir";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";

/**
 * El horario tal como lo necesita el calculador.
 *
 * Un establecimiento que todavía no declaró horario se trata como abierto 24
 * horas y sin cobrar lo cerrado. Es el supuesto menos dañino de los dos
 * posibles: suponerlo cerrado haría que ninguna permanencia se cobrara, y un
 * cobro de cero es más difícil de notar que uno de más.
 *
 * La pantalla de horario llega en la fase siguiente; hasta entonces esta
 * función es la única lectura del horario que existe.
 */
export async function horarioDelCobro(contexto: Contexto): Promise<HorarioDelCobro> {
  if (contexto.tipo !== "establecimiento") {
    return { abierto24h: true, franjas: [], cobraHorasCerradas: false };
  }

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [cabecera] = await tx.select().from(horarioAtencion).limit(1);

    if (!cabecera) {
      return { abierto24h: true, franjas: [], cobraHorasCerradas: false };
    }

    const franjas = await tx
      .select({
        diaSemana: horarioFranja.diaSemana,
        horaInicio: horarioFranja.horaApertura,
        horaFin: horarioFranja.horaCierre,
      })
      .from(horarioFranja)
      .where(eq(horarioFranja.horarioId, cabecera.id));

    return {
      abierto24h: cabecera.abierto24h,
      franjas,
      cobraHorasCerradas: cabecera.cobraHorasCerradas,
    };
  });
}

/**
 * ¿Alguien declaró el horario, o se está usando el supuesto?
 *
 * `horarioDelCobro` colapsa a propósito los dos casos: para calcular un cobro
 * da igual, porque "no declarado" se trata como abierto 24 horas. Para la
 * pantalla que dice qué falta configurar NO da igual, y sin esta distinción
 * un parqueadero recién creado se anuncia como "Abierto 24 horas" cuando en
 * realidad nadie lo definió.
 */
export async function horarioDeclarado(contexto: Contexto): Promise<boolean> {
  if (contexto.tipo !== "establecimiento") return false;

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [cabecera] = await tx.select({ id: horarioAtencion.id }).from(horarioAtencion).limit(1);
    return cabecera !== undefined;
  });
}

/**
 * ¿El establecimiento está abierto en ese instante? (FR-020)
 *
 * Puro: recibe el horario como dato. Se apoya en la expansión a instantes
 * absolutos, así que un horario que cruza la medianoche no necesita ningún
 * tratamiento especial acá.
 */
export function estaAbierto(horario: HorarioDelCobro, momento: Date): boolean {
  if (horario.abierto24h) return true;

  // Se pide una ventana de un minuto alrededor del instante: expandirHorario
  // trabaja con rangos, y un rango vacío no devolvería nada.
  const ventanas = expandirHorario(
    horario.franjas,
    momento,
    new Date(momento.getTime() + 60_000),
  );

  return ventanas.some((v) => v.desde <= momento && momento < v.hasta);
}
