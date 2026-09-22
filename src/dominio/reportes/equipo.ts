import { sql } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/**
 * Cómo le va a cada persona del equipo (maqueta 8c).
 *
 * Se separa de `miEquipo`, que responde "quién trabaja acá", porque responde
 * otra cosa: "cuánto vendió y cuándo trabaja". Mezclarlas obligaría a pagar las
 * agregaciones en toda pantalla que sólo quiera la lista.
 *
 * **Lo mira el administrador, no el operario.** Un operario que ve la caja de
 * sus compañeros puede compararla, y eso no es asunto suyo; para lo propio
 * tiene "Mis turnos". La pantalla que usa esto ya es de administrador, y la
 * comprobación vive igual acá porque una pantalla puede cambiar de manos.
 */

export type DesempenoDeCuenta = {
  usuarioId: string;
  /** Pesos cobrados en los últimos siete días. */
  vendido: number;
  /** Los turnos que tiene asignados, por nombre. */
  turnos: string[];
  /** Tiene una sesión de turno abierta ahora mismo. */
  enTurno: boolean;
};

const DIAS = 7;

export async function desempenoDelEquipo(
  contexto: Contexto,
  ahora: Date = new Date(),
): Promise<Map<string, DesempenoDeCuenta>> {
  exigir(contexto, "cuenta.gestionar.propia");
  const vacio = new Map<string, DesempenoDeCuenta>();
  if (contexto.tipo !== "establecimiento") return vacio;

  const desde = new Date(ahora.getTime() - DIAS * 24 * 3_600_000);

  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{
      usuario_id: string;
      vendido: number;
      turnos: string[] | null;
      en_turno: boolean;
    }>(sql`
      select
        a.usuario_id,
        -- El importe corregido cuando existe: el total tiene que cuadrar con la
        -- caja, y en la caja está lo que se cobró de verdad.
        coalesce((
          select sum(coalesce(
            (select c.importe_corregido from correccion c
              where c.movimiento_id = m.id order by c.emitida_en desc limit 1),
            m.importe, 0))
            from movimiento m
           where m.operario_salida = a.usuario_id
             and m.salida_en is not null
             and m.salida_en >= ${desde}
             and m.cortesia_motivo is null
        ), 0)::int as vendido,
        (select array_agg(distinct t.nombre order by t.nombre)
           from turno_asignacion ta
           join turno t on t.id = ta.turno_id
          where ta.usuario_id = a.usuario_id) as turnos,
        exists (
          select 1 from sesion_turno s
           where s.abierta_por = a.usuario_id and s.cerrada_en is null
        ) as en_turno
      from asignacion a
    `),
  );

  for (const f of filas.rows) {
    vacio.set(f.usuario_id, {
      usuarioId: f.usuario_id,
      vendido: f.vendido,
      turnos: f.turnos ?? [],
      enTurno: f.en_turno,
    });
  }

  return vacio;
}
