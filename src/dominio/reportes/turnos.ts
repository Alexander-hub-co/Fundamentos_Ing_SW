import { sql } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/**
 * Los reportes de turno de quien mira (maqueta 5a).
 *
 * Distintos de los del establecimiento en una cosa que no es de alcance sino de
 * PROPÓSITO: aquéllos responden "cómo va el negocio" y éstos responden "cómo me
 * fue en mi turno". Por eso el eje no es el calendario sino la sesión de turno,
 * y por eso las cifras son las que hacen falta para cuadrar una caja y entregarla.
 *
 * Siempre acotados a la propia cuenta, incluso para un administrador: son SUS
 * turnos. Para ver los de todos está el reporte del establecimiento.
 */

export type MetricaDeTurno = {
  vendido: number;
  /** Movimientos cerrados por esta persona en el turno. */
  cobros: number;
  entradas: number;
  ticketPromedio: number | null;
  /** Cobros que llegaron al tope de la tarifa plena. */
  enPlena: number;
  /** Salidas sin cobro y cuánto se dejó de cobrar. */
  sinCobro: number;
  sinCobroImporte: number;
};

/**
 * Lo que queda pendiente cuando termine el turno (maqueta 5a).
 *
 * Son las tres cifras que hacen falta para ENTREGAR la caseta, no para saber
 * cuánto se vendió: cuántos carros quedan adentro, cuántos de ellos entraron
 * conmigo, y cuántas salidas cerré de vehículos que había recibido otro.
 *
 * La tercera existe porque una entrada y su salida pueden pertenecer a turnos
 * distintos, y ésa es la fuente de casi todos los desacuerdos al cuadrar: la
 * venta cuenta para quien cobró, aunque el carro llevara adentro desde el turno
 * de la mañana.
 */
export type PendientesDeTurno = {
  /** Vehículos que siguen adentro del parqueadero, de quien sea. */
  adentro: number;
  /** De ésos, los que entraron durante este turno. */
  miasAbiertas: number;
  /** Salidas cobradas en este turno cuya entrada fue de otro. */
  cerradasDeOtroTurno: number;
};

export type TurnoAbierto = {
  sesionId: string;
  nombre: string;
  abiertaEn: Date;
  programadaInicio: string;
  metrica: MetricaDeTurno;
  porHora: { hora: number; vendido: number }[];
  porTipo: { nombre: string; vendido: number; cobros: number }[];
  pendientes: PendientesDeTurno;
};

export type TurnoPasado = {
  sesionId: string;
  nombre: string;
  abiertaEn: Date;
  cerradaEn: Date;
  programadaInicio: string;
  vendido: number;
  cobros: number;
  sinCobro: number;
};

/**
 * Una marca de tiempo que llegó por SQL crudo, convertida a fecha de verdad.
 *
 * `tx.execute` no pasa por el mapeo de tipos del esquema: el controlador
 * entrega los `timestamptz` como texto ("2026-08-24 20:01:34.329-05"), y el
 * genérico de la consulta puede declararlos `Date` sin que nada se queje. La
 * mentira no se nota hasta que alguien intenta FORMATEAR ese valor, y ahí sale
 * un `RangeError: Invalid time value` en la pantalla, no en la compilación.
 *
 * Pasó exactamente así: la pantalla de Mis turnos funcionó mientras nadie
 * tuvo un turno cerrado, y reventó el día que hubo uno. Por eso las consultas
 * de este archivo declaran `string` —que es lo que de verdad llega— y la
 * conversión ocurre acá, en un solo sitio.
 */
const aFecha = (valor: string | Date): Date =>
  valor instanceof Date ? valor : new Date(valor);

/** El importe que cuenta: el corregido si lo hay. Igual que en el otro reporte. */
const IMPORTE = sql`coalesce(
  (select c.importe_corregido from correccion c
    where c.movimiento_id = m.id order by c.emitida_en desc limit 1),
  m.importe, 0
)`;

export async function miTurnoAbierto(
  contexto: Contexto,
  ahora: Date = new Date(),
): Promise<TurnoAbierto | null> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return null;

  const abierta = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{
      id: string;
      nombre: string;
      abierta_en: string;
      programada_inicio: string;
    }>(sql`
      select s.id, t.nombre, s.abierta_en, s.programada_inicio
        from sesion_turno s
        join turno t on t.id = s.turno_id
       where s.abierta_por = ${contexto.usuarioId}
         and s.cerrada_en is null
       order by s.abierta_en desc
       limit 1
    `),
  ).then((r) => r.rows[0]);

  if (!abierta) return null;

  const abiertaEn = aFecha(abierta.abierta_en);

  const [metrica, porHora, porTipo, pendientes] = await Promise.all([
    metricaEntre(contexto, abiertaEn, ahora),
    vendidoPorHora(contexto, abiertaEn, ahora),
    vendidoPorTipo(contexto, abiertaEn, ahora),
    pendientesDe(contexto, abierta.id),
  ]);

  return {
    sesionId: abierta.id,
    nombre: abierta.nombre,
    abiertaEn,
    programadaInicio: abierta.programada_inicio,
    metrica,
    porHora,
    porTipo,
    pendientes,
  };
}

/**
 * Los turnos que esta persona ya cerró.
 *
 * Cada uno con lo que vendió, que es lo que permite comparar un día flojo con
 * uno bueno sin tener que recordarlo.
 */
export async function misTurnosPasados(
  contexto: Contexto,
  cuantos = 7,
): Promise<TurnoPasado[]> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return [];

  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{
      id: string;
      nombre: string;
      abierta_en: string;
      cerrada_en: string;
      programada_inicio: string;
      vendido: number;
      cobros: number;
      sin_cobro: number;
    }>(sql`
      select s.id, t.nombre, s.abierta_en, s.cerrada_en, s.programada_inicio,
             coalesce(sum(${IMPORTE}) filter (where m.cortesia_motivo is null), 0)::int as vendido,
             count(m.id) filter (where m.cortesia_motivo is null)::int as cobros,
             count(m.id) filter (where m.cortesia_motivo is not null)::int as sin_cobro
        from sesion_turno s
        join turno t on t.id = s.turno_id
        -- Por la izquierda: un turno sin un solo movimiento sigue siendo un
        -- turno que se trabajó, y esconderlo haría parecer que no se abrió.
        left join movimiento m
               on m.sesion_salida = s.id and m.salida_en is not null
       where s.abierta_por = ${contexto.usuarioId}
         and s.cerrada_en is not null
       group by s.id, t.nombre, s.abierta_en, s.cerrada_en, s.programada_inicio
       order by s.abierta_en desc
       limit ${cuantos}
    `),
  );

  return filas.rows.map((f) => ({
    sesionId: f.id,
    nombre: f.nombre,
    abiertaEn: aFecha(f.abierta_en),
    cerradaEn: aFecha(f.cerrada_en),
    programadaInicio: f.programada_inicio,
    vendido: f.vendido,
    cobros: f.cobros,
    sinCobro: f.sin_cobro,
  }));
}

async function metricaEntre(
  contexto: Contexto & { tipo: "establecimiento" },
  desde: Date,
  hasta: Date,
): Promise<MetricaDeTurno> {
  const f = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{
      vendido: number;
      cobros: number;
      en_plena: number;
      sin_cobro: number;
      sin_cobro_importe: number;
    }>(sql`
      select
        coalesce(sum(${IMPORTE}) filter (where m.cortesia_motivo is null), 0)::int as vendido,
        count(*) filter (where m.cortesia_motivo is null)::int as cobros,
        count(*) filter (where m.cobro->>'tope' = 'plena')::int as en_plena,
        count(*) filter (where m.cortesia_motivo is not null)::int as sin_cobro,
        coalesce(sum(m.cortesia_importe_omitido), 0)::int as sin_cobro_importe
      from movimiento m
      where m.salida_en is not null
        and m.operario_salida = ${contexto.usuarioId}
        and m.salida_en >= ${desde}
        and m.salida_en < ${hasta}
    `),
  ).then((r) => r.rows[0]);

  const entradas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ n: number }>(sql`
      select count(*)::int as n from movimiento m
       where m.operario_entrada = ${contexto.usuarioId}
         and m.entrada_en >= ${desde} and m.entrada_en < ${hasta}
    `),
  ).then((r) => r.rows[0]?.n ?? 0);

  const cobros = f?.cobros ?? 0;

  return {
    vendido: f?.vendido ?? 0,
    cobros,
    entradas,
    ticketPromedio: cobros > 0 ? Math.round((f?.vendido ?? 0) / cobros) : null,
    enPlena: f?.en_plena ?? 0,
    sinCobro: f?.sin_cobro ?? 0,
    sinCobroImporte: f?.sin_cobro_importe ?? 0,
  };
}

async function vendidoPorHora(
  contexto: Contexto & { tipo: "establecimiento" },
  desde: Date,
  hasta: Date,
): Promise<{ hora: number; vendido: number }[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ hora: number; vendido: number }>(sql`
      select extract(hour from m.salida_en at time zone 'America/Bogota')::int as hora,
             coalesce(sum(${IMPORTE}), 0)::int as vendido
        from movimiento m
       where m.salida_en is not null
         and m.operario_salida = ${contexto.usuarioId}
         and m.salida_en >= ${desde} and m.salida_en < ${hasta}
       group by 1
       order by 1
    `),
  );

  return filas.rows;
}

/**
 * Las tres cifras de entrega, en una sola consulta.
 *
 * Se cuentan por SESIÓN de turno y no por operario ni por rango de horas: la
 * sesión es la unidad que se abre y se cierra, y es la que el otro operario va
 * a recibir. Contar por persona daría otro número el día que alguien cubra
 * media jornada de un compañero.
 */
async function pendientesDe(
  contexto: Contexto & { tipo: "establecimiento" },
  sesionId: string,
): Promise<PendientesDeTurno> {
  const f = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ adentro: number; mias: number; ajenas: number }>(sql`
      select
        count(*) filter (where m.salida_en is null)::int as adentro,
        count(*) filter (where m.salida_en is null
                           and m.sesion_entrada = ${sesionId})::int as mias,
        count(*) filter (where m.salida_en is not null
                           and m.sesion_salida = ${sesionId}
                           and m.sesion_entrada is distinct from ${sesionId})::int as ajenas
      from movimiento m
    `),
  ).then((r) => r.rows[0]);

  return {
    adentro: f?.adentro ?? 0,
    miasAbiertas: f?.mias ?? 0,
    cerradasDeOtroTurno: f?.ajenas ?? 0,
  };
}

async function vendidoPorTipo(
  contexto: Contexto & { tipo: "establecimiento" },
  desde: Date,
  hasta: Date,
): Promise<{ nombre: string; vendido: number; cobros: number }[]> {
  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ nombre: string; vendido: number; cobros: number }>(sql`
      select t.nombre,
             coalesce(sum(${IMPORTE}), 0)::int as vendido,
             count(*)::int as cobros
        from movimiento m
        join tipo_vehiculo t on t.id = m.tipo_vehiculo_id
       where m.salida_en is not null
         and m.operario_salida = ${contexto.usuarioId}
         and m.salida_en >= ${desde} and m.salida_en < ${hasta}
       group by t.nombre, t.orden
       order by t.orden
    `),
  );

  return filas.rows;
}
