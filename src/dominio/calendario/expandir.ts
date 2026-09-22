/**
 * Conversión de reglas de reloj a instantes absolutos.
 *
 * Vive aparte de tarifas, horarios y turnos porque los tres la consumen. Bajo
 * `tarifas/` invitaría a un ciclo de dependencias.
 *
 * ESTA ES LA ÚNICA PARTE DEL SISTEMA QUE RAZONA SOBRE MEDIANOCHES. Un horario
 * de 20:00 a 06:00 y un turno nocturno de 22:00 a 06:00 son la misma clase de
 * problema, y se resuelven acá una sola vez: se expanden a pares de instantes
 * absolutos y de ahí en adelante nadie vuelve a preguntarse si algo cruza el
 * día. La alternativa —aritmética sobre horas del reloj con un caso especial
 * para la medianoche— es exactamente cómo se escriben los errores de horario:
 * cada caso especial nuevo rompe otro.
 *
 * Es puro: no lee el reloj, no toca la base y no depende de la zona horaria del
 * servidor.
 */

/** Zona horaria del negocio. Colombia no tiene horario de verano. */
export const ZONA = "America/Bogota";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Una ventana de tiempo real, con principio y fin. */
export type Ventana = { desde: Date; hasta: Date };

/** Una regla que se repite: "de tal hora a tal hora, estos días". */
export type ReglaHoraria = {
  /** 0 = domingo, 6 = sábado. */
  diaSemana: number;
  /** `HH:MM` o `HH:MM:SS`. */
  horaInicio: string;
  /** Menor que `horaInicio` ⇒ la regla termina al día siguiente. */
  horaFin: string;
};

/** Minutos desde la medianoche que representa `HH:MM[:SS]`. */
export function minutosDelDia(hora: string): number {
  const [h = "0", m = "0"] = hora.split(":");
  return Number.parseInt(h, 10) * 60 + Number.parseInt(m, 10);
}

/**
 * Día de la semana y comienzo del día, en hora local de Colombia.
 *
 * Se usa `Intl` en vez de los métodos del `Date` porque esos responden en la
 * zona del servidor, y el servidor no tiene por qué estar en Bogotá.
 */
function enZona(instante: Date): { diaSemana: number; medianoche: Date } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instante);

  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // El desfase de Colombia es fijo (-05:00), así que la medianoche local es
  // determinable sin consultar reglas de transición.
  const medianoche = new Date(
    `${parte("year")}-${parte("month")}-${parte("day")}T00:00:00-05:00`,
  );

  return { diaSemana: dias.indexOf(parte("weekday")), medianoche };
}

/**
 * Expande reglas horarias a ventanas absolutas que se solapen con `[desde,
 * hasta)`.
 *
 * Se examina también el día anterior al del comienzo: una regla que cruza la
 * medianoche puede haber arrancado ayer y seguir vigente ahora. Olvidarlo es el
 * error clásico —"a las 02:00 del martes no hay nada abierto"— cuando el turno
 * nocturno del lunes sigue corriendo.
 */
export function expandirHorario(
  reglas: readonly ReglaHoraria[],
  desde: Date,
  hasta: Date,
): Ventana[] {
  if (reglas.length === 0 || hasta <= desde) return [];

  const ventanas: Ventana[] = [];
  const { medianoche: primerDia } = enZona(desde);

  // Se arranca un día antes por las reglas que cruzan la medianoche, y se
  // termina un día después del final por la misma razón.
  for (
    let dia = new Date(primerDia.getTime() - MS_POR_DIA);
    dia.getTime() <= hasta.getTime() + MS_POR_DIA;
    dia = new Date(dia.getTime() + MS_POR_DIA)
  ) {
    const { diaSemana } = enZona(dia);

    for (const regla of reglas) {
      if (regla.diaSemana !== diaSemana) continue;

      const inicio = minutosDelDia(regla.horaInicio);
      const fin = minutosDelDia(regla.horaFin);
      const cruzaMedianoche = fin <= inicio;

      const abre = new Date(dia.getTime() + inicio * 60_000);
      const cierra = new Date(
        dia.getTime() + (cruzaMedianoche ? fin + 24 * 60 : fin) * 60_000,
      );

      if (cierra > desde && abre < hasta) ventanas.push({ desde: abre, hasta: cierra });
    }
  }

  return ventanas.sort((a, b) => a.desde.getTime() - b.desde.getTime());
}

/**
 * Corta `[desde, hasta)` en un tramo por día calendario local.
 *
 * Es lo que necesita un establecimiento de 24 horas, donde la jornada tarifaria
 * se reinicia a medianoche.
 */
export function partirPorDia(desde: Date, hasta: Date): Ventana[] {
  if (hasta <= desde) return [];

  const tramos: Ventana[] = [];
  let cursor = desde;

  while (cursor < hasta) {
    const { medianoche } = enZona(cursor);
    const siguiente = new Date(medianoche.getTime() + MS_POR_DIA);
    const fin = siguiente < hasta ? siguiente : hasta;
    tramos.push({ desde: cursor, hasta: fin });
    cursor = fin;
  }

  return tramos;
}

/** Intersección de dos ventanas, o null si no se tocan. */
export function intersecar(a: Ventana, b: Ventana): Ventana | null {
  const desde = a.desde > b.desde ? a.desde : b.desde;
  const hasta = a.hasta < b.hasta ? a.hasta : b.hasta;
  return hasta > desde ? { desde, hasta } : null;
}

/** Minutos de una ventana, redondeados hacia arriba. */
export function minutosDe(v: Ventana): number {
  return Math.ceil((v.hasta.getTime() - v.desde.getTime()) / 60_000);
}
