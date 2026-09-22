import { sql } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { diasDe, rangoAnterior, rangoDe, variacion, type Periodo, type Rango } from "./rangos";

/**
 * Los reportes del establecimiento (maqueta 2i).
 *
 * **Son fiables por el Principio IV y no por casualidad**: cada movimiento
 * guardó copia de la tarifa y de los convenios aplicados al cobrar, así que
 * estas cifras se re-derivan de lo que de verdad pasó. Un reporte que
 * recalculara con las tarifas de hoy contaría otra historia cada vez que
 * alguien cambia un precio.
 *
 * Se lee lo CORREGIDO cuando existe. El total tiene que cuadrar con la caja, y
 * en la caja está lo que se cobró de verdad, no lo que se cobró primero.
 */

export type Metrica = {
  ingresos: number;
  movimientos: number;
  /** Minutos. Nulo cuando no hubo movimientos. */
  permanenciaMedia: number | null;
  ticketPromedio: number | null;
  /** Qué porcentaje de los cobros llegó al tope de la tarifa plena. */
  porcentajeEnPlena: number | null;
};

export type PorTipo = { nombre: string; permanenciaMedia: number; movimientos: number };
export type PorDia = { dia: Date; ingresos: number; cerrado: boolean };
export type PorPersona = { nombre: string; ingresos: number };
export type PorHora = { hora: number; entradas: number };
export type IngresoPorHora = { hora: number; ingresos: number };

export type Reporte = {
  periodo: Periodo;
  rango: Rango;
  actual: Metrica;
  /** Cuánto cambiaron los ingresos respecto del período anterior, en %. */
  variacionIngresos: number | null;
  porTipo: PorTipo[];
  porDia: PorDia[];
  porPersona: PorPersona[];
  porHora: PorHora[];
  /**
   * Lo cobrado hora a hora. Es lo que se dibuja cuando el período es un día o
   * un turno, donde un gráfico por día tendría una sola barra.
   */
  ingresosPorHora: IngresoPorHora[];
  /** Verdadero cuando quien mira sólo ve lo suyo. */
  soloMios: boolean;
};

/**
 * El instante en que arrancó el turno vigente.
 *
 * Se toma la sesión abierta más antigua; si no hay ninguna, la última que
 * cerró. Un establecimiento que nunca abrió turno no tiene "turno" del que
 * informar, y decirlo es mejor que devolver el día disfrazado.
 */
async function inicioDelTurno(
  contexto: Contexto & { tipo: "establecimiento" },
  soloMios: boolean,
): Promise<Date | null> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ abierta_en: Date }>(sql`
      select abierta_en
        from sesion_turno
       where true
         ${soloMios ? sql`and abierta_por = ${contexto.usuarioId}` : sql``}
       order by (cerrada_en is null) desc, abierta_en desc
       limit 1
    `),
  );

  return filas.rows[0]?.abierta_en ?? null;
}

export async function reporteDelEstablecimiento(
  contexto: Contexto,
  periodo: Periodo,
  ahora: Date = new Date(),
): Promise<Reporte | null> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return null;

  // Un operario ve sólo lo que él cobró. Comparar cajas con sus compañeros no
  // es asunto suyo, y es la misma regla que rige la pantalla de cobros.
  const soloMios = contexto.rol === "operario";

  let rango: Rango;
  if (periodo === "turno") {
    const inicio = await inicioDelTurno(contexto, soloMios);
    if (!inicio) return null;
    rango = { desde: inicio, hasta: ahora, etiqueta: "este turno" };
  } else {
    rango = rangoDe(periodo, ahora);
  }

  const previo = rangoAnterior(rango);

  const [actual, anterior, porTipo, porDia, porPersona, porHora, ingresosPorHora] =
    await Promise.all([
      metricaDe(contexto, rango, soloMios),
      metricaDe(contexto, previo, soloMios),
      permanenciaPorTipo(contexto, rango, soloMios),
      ingresosPorDia(contexto, periodo, rango, soloMios),
      ingresosPorPersona(contexto, rango, soloMios),
      entradasPorHora(contexto, rango, soloMios),
      cobradoPorHora(contexto, rango, soloMios),
    ]);

  return {
    periodo,
    rango,
    actual,
    variacionIngresos: variacion(actual.ingresos, anterior.ingresos),
    porTipo,
    porDia,
    porPersona,
    porHora,
    ingresosPorHora,
    soloMios,
  };
}

/**
 * El importe que cuenta: el corregido si lo hay, si no el original.
 *
 * Se resuelve en SQL y no en memoria porque las agregaciones de abajo tienen
 * que verlo ya resuelto; hacerlo dos veces, una acá y otra allá, es como
 * empiezan a discrepar dos cifras de la misma pantalla.
 */
const IMPORTE = sql`coalesce(
  (select c.importe_corregido from correccion c
    where c.movimiento_id = m.id order by c.emitida_en desc limit 1),
  m.importe, 0
)`;

const mios = (contexto: Contexto & { tipo: "establecimiento" }, soloMios: boolean) =>
  soloMios ? sql`and m.operario_salida = ${contexto.usuarioId}` : sql``;

async function metricaDe(
  contexto: Contexto & { tipo: "establecimiento" },
  rango: Rango,
  soloMios: boolean,
): Promise<Metrica> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{
      ingresos: number;
      movimientos: number;
      minutos: number | null;
      en_plena: number;
    }>(sql`
      select
        coalesce(sum(${IMPORTE}), 0)::int as ingresos,
        count(*)::int as movimientos,
        avg(extract(epoch from (m.salida_en - m.entrada_en)) / 60) as minutos,
        -- El tope es una cadena en la copia embebida del cobro, y vale
        -- ninguno, minima o plena.
        count(*) filter (where m.cobro->>'tope' = 'plena')::int as en_plena
      from movimiento m
      where m.salida_en is not null
        and m.salida_en >= ${rango.desde}
        and m.salida_en < ${rango.hasta}
        ${mios(contexto, soloMios)}
    `),
  );

  const f = filas.rows[0];
  const movimientos = f?.movimientos ?? 0;

  return {
    ingresos: f?.ingresos ?? 0,
    movimientos,
    permanenciaMedia: f?.minutos != null ? Math.round(Number(f.minutos)) : null,
    ticketPromedio: movimientos > 0 ? Math.round((f?.ingresos ?? 0) / movimientos) : null,
    porcentajeEnPlena: movimientos > 0 ? ((f?.en_plena ?? 0) / movimientos) * 100 : null,
  };
}

async function permanenciaPorTipo(
  contexto: Contexto & { tipo: "establecimiento" },
  rango: Rango,
  soloMios: boolean,
): Promise<PorTipo[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ nombre: string; minutos: number; movimientos: number }>(sql`
      select t.nombre,
             avg(extract(epoch from (m.salida_en - m.entrada_en)) / 60) as minutos,
             count(*)::int as movimientos
        from movimiento m
        join tipo_vehiculo t on t.id = m.tipo_vehiculo_id
       where m.salida_en is not null
         and m.salida_en >= ${rango.desde}
         and m.salida_en < ${rango.hasta}
         ${mios(contexto, soloMios)}
       group by t.nombre, t.orden
       order by t.orden
    `),
  );

  return filas.rows.map((f) => ({
    nombre: f.nombre,
    permanenciaMedia: Math.round(Number(f.minutos)),
    movimientos: f.movimientos,
  }));
}

async function ingresosPorDia(
  contexto: Contexto & { tipo: "establecimiento" },
  periodo: Periodo,
  rango: Rango,
  soloMios: boolean,
): Promise<PorDia[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ dia: string; ingresos: number }>(sql`
      select to_char(m.salida_en at time zone 'America/Bogota', 'YYYY-MM-DD') as dia,
             coalesce(sum(${IMPORTE}), 0)::int as ingresos
        from movimiento m
       where m.salida_en is not null
         and m.salida_en >= ${rango.desde}
         and m.salida_en < ${rango.hasta}
         ${mios(contexto, soloMios)}
       group by 1
    `),
  );

  const porFecha = new Map(filas.rows.map((f) => [f.dia, f.ingresos]));

  // Los días sin ingresos se dibujan igual, en cero. Saltárselos comprimiría el
  // gráfico y haría parecer que el domingo cerrado no existió.
  return diasDe(periodo, rango).map((dia) => {
    const clave = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dia);
    const ingresos = porFecha.get(clave) ?? 0;
    return { dia, ingresos, cerrado: ingresos === 0 };
  });
}

async function ingresosPorPersona(
  contexto: Contexto & { tipo: "establecimiento" },
  rango: Rango,
  soloMios: boolean,
): Promise<PorPersona[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ usuario_id: string; ingresos: number }>(sql`
      select m.operario_salida as usuario_id,
             coalesce(sum(${IMPORTE}), 0)::int as ingresos
        from movimiento m
       where m.salida_en is not null
         and m.operario_salida is not null
         and m.salida_en >= ${rango.desde}
         and m.salida_en < ${rango.hasta}
         ${mios(contexto, soloMios)}
       group by 1
       order by 2 desc
       limit 8
    `),
  );

  if (filas.rows.length === 0) return [];

  // Los nombres viven en la tabla de plataforma, fuera del ámbito. Se piden con
  // el mismo privilegio acotado que usa la barra lateral para mostrar quién
  // está trabajando.
  const { comoPlataforma } = await import("@/db/ambito");
  const { usuario } = await import("@/db/esquema");
  const { inArray } = await import("drizzle-orm");

  const cuentas = await comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select({ id: usuario.id, nombre: usuario.name })
      .from(usuario)
      .where(inArray(usuario.id, filas.rows.map((f) => f.usuario_id))),
  );

  const nombres = new Map(cuentas.map((c) => [c.id, c.nombre]));

  return filas.rows.map((f) => ({
    nombre: nombres.get(f.usuario_id) ?? "Cuenta retirada",
    ingresos: f.ingresos,
  }));
}

/**
 * Lo cobrado hora a hora, dentro del rango.
 *
 * Sólo se dibuja cuando el período es un día o un turno. En una semana serían
 * ciento sesenta y ocho columnas, que no es un gráfico sino una textura.
 */
async function cobradoPorHora(
  contexto: Contexto & { tipo: "establecimiento" },
  rango: Rango,
  soloMios: boolean,
): Promise<IngresoPorHora[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ hora: number; ingresos: number }>(sql`
      select extract(hour from m.salida_en at time zone 'America/Bogota')::int as hora,
             coalesce(sum(${IMPORTE}), 0)::int as ingresos
        from movimiento m
       where m.salida_en is not null
         and m.salida_en >= ${rango.desde}
         and m.salida_en < ${rango.hasta}
         ${mios(contexto, soloMios)}
       group by 1
    `),
  );

  const porHora = new Map(filas.rows.map((f) => [f.hora, f.ingresos]));
  return Array.from({ length: 24 }, (_, hora) => ({ hora, ingresos: porHora.get(hora) ?? 0 }));
}

/**
 * A qué horas entra la gente.
 *
 * Se cuenta la ENTRADA y no la salida: lo que esta cifra sirve para decidir es
 * a qué hora hace falta más gente en la caseta, y eso lo determina cuándo
 * llegan los vehículos.
 */
async function entradasPorHora(
  contexto: Contexto & { tipo: "establecimiento" },
  rango: Rango,
  soloMios: boolean,
): Promise<PorHora[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ hora: number; entradas: number }>(sql`
      select extract(hour from m.entrada_en at time zone 'America/Bogota')::int as hora,
             count(*)::int as entradas
        from movimiento m
       where m.entrada_en >= ${rango.desde}
         and m.entrada_en < ${rango.hasta}
         ${soloMios ? sql`and m.operario_entrada = ${contexto.usuarioId}` : sql``}
       group by 1
    `),
  );

  const porHora = new Map(filas.rows.map((f) => [f.hora, f.entradas]));

  // Las 24 horas, con ceros incluidos: un hueco en el medio del histograma
  // significa "a esa hora no entró nadie", que es información.
  return Array.from({ length: 24 }, (_, hora) => ({
    hora,
    entradas: porHora.get(hora) ?? 0,
  }));
}
