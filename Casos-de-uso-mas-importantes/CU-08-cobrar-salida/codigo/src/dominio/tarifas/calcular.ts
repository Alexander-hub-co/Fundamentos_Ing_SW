import { minutosDe, type Ventana } from "@/dominio/calendario/expandir";
import { partirEnJornadas, type HorarioDelCobro } from "./jornadas";
import { MINUTOS_PRIMERA_HORA } from "./modelos";
import type {
  Cobro,
  ModeloCobro,
  TarifaAplicable,
  TarifaPorIntervalo,
  TarifaPorMinuto,
  TarifaPrimeraHoraYFraccion,
  TopeAplicado,
  TramoCobrado,
} from "./modelos";

/**
 * El calculador.
 *
 * PURO: no importa nada de `src/db`, no lee el reloj y no consulta nada. Dados
 * dos instantes, una tarifa y un horario, devuelve el importe y su desglose.
 * Eso es lo que permite probar el motor de cobro entero sin que exista un solo
 * movimiento, y lo que dejará a la taquilla mostrar el total parcial de un
 * vehículo que sigue adentro invocando el mismo cálculo con `salida = ahora`.
 *
 * Hay una prueba que verifica esa pureza leyendo los imports de este archivo,
 * para que no se rompa en silencio dentro de seis meses.
 */

/** Cobro de un tramo bajo el modelo por minuto. */
function porMinuto(tarifa: TarifaPorMinuto, tramo: Ventana): TramoCobrado {
  const minutos = minutosDe(tramo);
  const calculado = minutos * tarifa.valorMinuto;

  let importe = calculado;
  let tope: TopeAplicado = "ninguno";

  if (calculado < tarifa.tarifaMinima) {
    importe = tarifa.tarifaMinima;
    tope = "minima";
  } else if (calculado > tarifa.tarifaPlena) {
    importe = tarifa.tarifaPlena;
    tope = "plena";
  }

  return { desde: tramo.desde, hasta: tramo.hasta, minutos, importe, tope };
}

/** Cobro de un tramo bajo el modelo por intervalos. */
function porIntervalo(tarifa: TarifaPorIntervalo, tramo: Ventana): TramoCobrado {
  const minutos = minutosDe(tramo);
  // Cualquier fracción cobra el intervalo entero: 31 minutos son dos bloques
  // de 30, no uno y pico.
  const intervalos = Math.ceil(minutos / tarifa.intervaloMinutos);
  const calculado = intervalos * tarifa.valorIntervalo;

  const supera = calculado > tarifa.tarifaPlena;

  return {
    desde: tramo.desde,
    hasta: tramo.hasta,
    minutos,
    intervalos,
    importe: supera ? tarifa.tarifaPlena : calculado,
    tope: supera ? "plena" : "ninguno",
  };
}

/**
 * Cobro de un tramo con primera hora fija y después bloques.
 *
 * La primera hora se cobra entera aunque la permanencia sea menor: es el punto
 * del modelo. Pasada esa hora, cada fracción de bloque cobra el bloque
 * completo.
 */
function primeraHoraYFraccion(
  tarifa: TarifaPrimeraHoraYFraccion,
  tramo: Ventana,
): TramoCobrado {
  const minutos = minutosDe(tramo);

  const despues = Math.max(0, minutos - MINUTOS_PRIMERA_HORA);
  const intervalos = Math.ceil(despues / tarifa.intervaloMinutos);
  const calculado = tarifa.valorPrimeraHora + intervalos * tarifa.valorIntervalo;

  const supera = calculado > tarifa.tarifaPlena;

  return {
    desde: tramo.desde,
    hasta: tramo.hasta,
    minutos,
    intervalos,
    importe: supera ? tarifa.tarifaPlena : calculado,
    tope: supera ? "plena" : "ninguno",
  };
}

/**
 * Despacho por modelo.
 *
 * Agregar un tercer modelo es agregar su función y su entrada acá. Los
 * existentes no se tocan, que es literalmente lo que exige el Principio II.
 */
const CALCULADORES: {
  [M in ModeloCobro]: (tarifa: Extract<TarifaAplicable, { modelo: M }>, tramo: Ventana) => TramoCobrado;
} = {
  por_minuto: porMinuto,
  por_intervalo: porIntervalo,
  primera_hora_y_fraccion: primeraHoraYFraccion,
};

function cobrarTramo(tarifa: TarifaAplicable, tramo: Ventana): TramoCobrado {
  switch (tarifa.modelo) {
    case "por_minuto":
      return CALCULADORES.por_minuto(tarifa, tramo);
    case "por_intervalo":
      return CALCULADORES.por_intervalo(tarifa, tramo);
    case "primera_hora_y_fraccion":
      return CALCULADORES.primera_hora_y_fraccion(tarifa, tramo);
  }
}

/**
 * Importe de una permanencia.
 *
 * El alcance de la plena decide cómo se suman los tramos:
 *
 *   - `jornada`: cada tramo se topa por su cuenta y los importes se suman. Una
 *     bicicleta guardada tres días paga tres plenas.
 *   - `estadia`: se calcula igual, pero el total se topa una sola vez al final.
 *     Un carro guardado tres días paga una sola plena.
 */
export function calcularImporte(datos: {
  entrada: Date;
  salida: Date;
  tarifa: TarifaAplicable;
  horario: HorarioDelCobro;
  /**
   * Minutos que no se cobran, por un convenio que regala tiempo.
   *
   * Opcional y con valor neutro, de modo que ninguna llamada anterior cambia.
   * Se restan del tiempo COBRABLE y no del importe: el valor de un minuto
   * depende de la tarifa, de la plena y de la mínima, así que una hora gratis
   * no equivale a un monto fijo.
   */
  minutosGratis?: number;
}): Cobro {
  const { entrada, salida, tarifa, horario } = datos;

  const jornadas = regalar(partirEnJornadas(entrada, salida, horario), datos.minutosGratis ?? 0);
  const tramos = jornadas.map((j) => cobrarTramo(tarifa, j));

  const minutosTotales = tramos.reduce((n, t) => n + t.minutos, 0);
  const sumado = tramos.reduce((n, t) => n + t.importe, 0);

  if (tarifa.alcancePlena === "jornada") {
    return {
      importe: sumado,
      minutosTotales,
      tramos,
      // Con plena por jornada no hay un tope único del total: se informa el
      // del último tramo que lo alcanzó, si alguno lo hizo.
      tope: tramos.some((t) => t.tope === "plena")
        ? "plena"
        : tramos.some((t) => t.tope === "minima")
          ? "minima"
          : "ninguno",
    };
  }

  const supera = sumado > tarifa.tarifaPlena;

  return {
    importe: supera ? tarifa.tarifaPlena : sumado,
    minutosTotales,
    tramos,
    tope: supera ? "plena" : (tramos[0]?.tope ?? "ninguno"),
  };
}

/**
 * Consume los minutos regalados desde el COMIENZO de la permanencia.
 *
 * Tramo por tramo: si a un tramo le sobran minutos regalados, desaparece entero
 * y el resto pasa al siguiente. Si no, se le recorta el comienzo.
 *
 * Se eligió el comienzo y no el final porque "la primera hora es gratis" es la
 * lectura natural del acuerdo. No es indiferente: con la plena por jornada cada
 * tramo se topa por separado, así que quitar minutos de un extremo o del otro
 * da importes distintos. Había que elegir uno y dejarlo escrito.
 *
 * Se recorta la ventana y no los minutos a secas porque dentro de un tramo todo
 * minuto es cobrable —las horas cerradas ya quedaron fuera al partir en
 * jornadas—, de modo que mover el inicio equivale exactamente a descontar
 * minutos facturables.
 */
function regalar(jornadas: Ventana[], minutosGratis: number): Ventana[] {
  if (minutosGratis <= 0) return jornadas;

  let restantes = minutosGratis;
  const quedan: Ventana[] = [];

  for (const j of jornadas) {
    if (restantes <= 0) {
      quedan.push(j);
      continue;
    }

    const minutos = minutosDe(j);
    if (restantes >= minutos) {
      // El tramo entero sale gratis y no llega a cobrarse.
      restantes -= minutos;
      continue;
    }

    quedan.push({ desde: new Date(j.desde.getTime() + restantes * 60_000), hasta: j.hasta });
    restantes = 0;
  }

  return quedan;
}

/**
 * Total parcial de un vehículo que sigue adentro.
 *
 * Es el mismo cálculo con el momento actual como salida. Existe con nombre
 * propio para que la taquilla no tenga que recordar el truco, y recibe `ahora`
 * como argumento para no leer el reloj: así sigue siendo determinista y
 * probable.
 */
export function totalParcial(datos: {
  entrada: Date;
  ahora: Date;
  tarifa: TarifaAplicable;
  horario: HorarioDelCobro;
}): Cobro {
  return calcularImporte({
    entrada: datos.entrada,
    salida: datos.ahora,
    tarifa: datos.tarifa,
    horario: datos.horario,
  });
}
