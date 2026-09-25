import {
  expandirHorario,
  intersecar,
  partirPorDia,
  type ReglaHoraria,
  type Ventana,
} from "@/dominio/calendario/expandir";

/**
 * Reparto de una permanencia en jornadas tarifarias.
 *
 * La jornada es el tramo sobre el que se aplica la tarifa plena cuando la
 * tarifa declara que su plena es por jornada. Sin este reparto, una bicicleta
 * guardada tres días pagaría lo mismo que una guardada una tarde.
 *
 * Puro: ni base de datos ni reloj.
 */

/** Cómo abre el establecimiento, y si cobra lo cerrado. */
export type HorarioDelCobro = {
  abierto24h: boolean;
  franjas: readonly ReglaHoraria[];
  cobraHorasCerradas: boolean;
};

/**
 * Parte `[entrada, salida)` en los tramos que se cobran.
 *
 * Tres casos, y ninguno es un caso especial en el código:
 *
 *   1. **24 horas** — los cortes son las medianoches locales.
 *   2. **Con horario, sin cobrar lo cerrado** — se intersecta la permanencia
 *      con las ventanas de atención. Lo que cae fuera desaparece, y puede no
 *      quedar ningún tramo: una bicicleta que entra y sale mientras el local
 *      está cerrado no genera cobro.
 *   3. **Con horario, cobrando lo cerrado** — los tramos son contiguos y
 *      cubren toda la permanencia; los cortes son las aperturas, para que cada
 *      jornada empiece cuando el establecimiento abre.
 */
export function partirEnJornadas(
  entrada: Date,
  salida: Date,
  horario: HorarioDelCobro,
): Ventana[] {
  if (salida <= entrada) return [];

  if (horario.abierto24h) return partirPorDia(entrada, salida);

  const ventanas = expandirHorario(horario.franjas, entrada, salida);
  const permanencia: Ventana = { desde: entrada, hasta: salida };

  if (!horario.cobraHorasCerradas) {
    return ventanas
      .map((v) => intersecar(v, permanencia))
      .filter((v): v is Ventana => v !== null);
  }

  // Cobrando lo cerrado, la permanencia se cubre entera. Los cortes son las
  // aperturas que caen dentro: así una noche cerrada queda pegada al tramo que
  // viene antes en vez de perderse, y la jornada siguiente empieza al abrir.
  const cortes = ventanas
    .map((v) => v.desde)
    .filter((d) => d > entrada && d < salida)
    .sort((a, b) => a.getTime() - b.getTime());

  const tramos: Ventana[] = [];
  let cursor = entrada;
  for (const corte of cortes) {
    if (corte > cursor) {
      tramos.push({ desde: cursor, hasta: corte });
      cursor = corte;
    }
  }
  tramos.push({ desde: cursor, hasta: salida });

  return tramos;
}
