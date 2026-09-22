/**
 * Los períodos sobre los que se informa.
 *
 * PURO: no toca la base ni lee el reloj por su cuenta. Recibe el instante y
 * devuelve el rango, que es lo que permite probar los bordes —el cambio de mes,
 * el lunes— sin esperar a que llegue la fecha.
 *
 * **Todo en la zona del establecimiento**, no en la del servidor. Sin eso, un
 * cobro de las nueve de la noche cae en el día siguiente y quien cuadra la caja
 * a las diez no lo encuentra. Es el mismo cuidado que ya toma el cálculo de
 * jornadas.
 */

export type Periodo = "dia" | "semana" | "mes" | "turno";

export const PERIODOS: { valor: Periodo; titulo: string }[] = [
  { valor: "dia", titulo: "Día" },
  { valor: "semana", titulo: "Semana" },
  { valor: "mes", titulo: "Mes" },
  { valor: "turno", titulo: "Turno" },
];

export type Rango = {
  desde: Date;
  hasta: Date;
  /** Cómo se nombra en pantalla: "hoy", "esta semana"… */
  etiqueta: string;
};

const ZONA = "America/Bogota";

/** El mismo instante, visto como si el reloj del servidor fuera el de Bogotá. */
function enZona(momento: Date): { local: Date; desfase: number } {
  const local = new Date(momento.toLocaleString("en-US", { timeZone: ZONA }));
  return { local, desfase: momento.getTime() - local.getTime() };
}

/**
 * El rango de un período.
 *
 * `turno` no se calcula acá: depende de cuándo se abrió una sesión, que es un
 * dato de la base. Quien lo pida aporta ese instante.
 */
export function rangoDe(periodo: Exclude<Periodo, "turno">, ahora: Date): Rango {
  const { local, desfase } = enZona(ahora);
  const inicio = new Date(local);
  inicio.setHours(0, 0, 0, 0);

  if (periodo === "semana") {
    // La semana arranca el LUNES, que es como se cuenta acá. `getDay()` pone el
    // domingo en 0, así que hay que correrlo o el domingo se llevaría toda la
    // semana siguiente.
    const dia = inicio.getDay();
    inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
  }

  if (periodo === "mes") inicio.setDate(1);

  return {
    desde: new Date(inicio.getTime() + desfase),
    hasta: ahora,
    etiqueta: periodo === "dia" ? "hoy" : periodo === "semana" ? "esta semana" : "este mes",
  };
}

/**
 * El período INMEDIATAMENTE anterior, del mismo largo.
 *
 * Existe para el "+8,4 % frente a la semana anterior" de la maqueta. Se toma
 * del mismo largo y no el mes calendario anterior: comparar cinco días de este
 * mes contra treinta del pasado daría una caída que no ocurrió.
 */
export function rangoAnterior(rango: Rango): Rango {
  const largo = rango.hasta.getTime() - rango.desde.getTime();
  return {
    desde: new Date(rango.desde.getTime() - largo),
    hasta: new Date(rango.desde),
    etiqueta: "el período anterior",
  };
}

/**
 * Cuánto cambió, en porcentaje.
 *
 * Devuelve nulo cuando antes no hubo nada: "subió un infinito por ciento" no
 * dice nada, y un cero de partida es lo normal en un parqueadero que abrió esta
 * semana.
 */
export function variacion(ahora: number, antes: number): number | null {
  if (antes <= 0) return null;
  return ((ahora - antes) / antes) * 100;
}

/**
 * Los días que ocupa el gráfico.
 *
 * **El período ENTERO, no sólo los transcurridos.** Una semana son siete
 * columnas aunque hoy sea martes: los días que faltan salen en cero y eso es
 * información —dice en qué punto de la semana va— mientras que dibujar dos
 * columnas anchas hace parecer que la semana tiene dos días.
 *
 * Para el día y el turno no devuelve nada: un gráfico de barras de una sola
 * barra no compara con nada, y quien llama debe mostrar otra cosa. Ese era el
 * "una barra fea" que se veía.
 */
export function diasDe(periodo: Periodo, rango: Rango): Date[] {
  if (periodo === "dia" || periodo === "turno") return [];

  const dias: Date[] = [];
  const { local, desfase } = enZona(rango.desde);
  const cursor = new Date(local);
  cursor.setHours(0, 0, 0, 0);

  const cuantos = periodo === "semana" ? 7 : diasDelMes(cursor);

  for (let i = 0; i < cuantos; i++) {
    dias.push(new Date(cursor.getTime() + desfase));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

/** Cuántos días tiene el mes al que pertenece esa fecha. */
function diasDelMes(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
}
