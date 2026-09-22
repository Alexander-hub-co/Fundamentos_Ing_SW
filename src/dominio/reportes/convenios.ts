import { sql } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { rangoDe } from "./rangos";

/**
 * Cuánto se está usando cada convenio, y cuánto cuesta (maqueta 8b).
 *
 * Sale de la copia embebida del cobro y no de la tabla de convenios, y eso es
 * lo que lo hace fiable: un convenio que hoy descuenta el 20 % pudo descontar
 * el 30 % el mes pasado, y lo que se dejó de cobrar entonces fue el 30 %.
 * Recalcularlo con la regla vigente daría una cifra que nunca ocurrió.
 *
 * "Sin cobrar" es el dato que convierte un convenio en una decisión de negocio:
 * es lo que el establecimiento le está regalando —o facturando aparte— a ese
 * comercio, y sin verlo nadie sabe si el acuerdo vale la pena.
 */

export type UsoDeConvenio = {
  convenioId: string;
  /** Veces que se aplicó de verdad en el mes. */
  usos: number;
  /** Pesos que dejaron de cobrarse por él. */
  sinCobrar: number;
};

export async function usoDeConveniosEsteMes(
  contexto: Contexto,
  ahora: Date = new Date(),
): Promise<Map<string, UsoDeConvenio>> {
  exigir(contexto, "parqueadero.ver.propio");
  const uso = new Map<string, UsoDeConvenio>();
  if (contexto.tipo !== "establecimiento") return uso;

  const mes = rangoDe("mes", ahora);

  const filas = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<{ convenio_id: string; usos: number; sin_cobrar: number }>(sql`
      select b->>'convenioId' as convenio_id,
             count(*)::int as usos,
             coalesce(sum((b->>'descontado')::int), 0)::int as sin_cobrar
        from movimiento m
        cross join lateral jsonb_array_elements(m.cobro->'beneficios') as b
       where m.salida_en is not null
         and m.salida_en >= ${mes.desde}
         and m.salida_en < ${mes.hasta}
         -- Los que NO se aplicaron viajan igual en el desglose, con su motivo,
         -- para poder explicarle al cliente por qué no se le hizo el descuento.
         -- Contarlos como usos sería mentir sobre el acuerdo.
         and b->>'noAplicado' is null
       group by 1
    `),
  );

  for (const f of filas.rows) {
    if (!f.convenio_id) continue;
    uso.set(f.convenio_id, {
      convenioId: f.convenio_id,
      usos: f.usos,
      sinCobrar: f.sin_cobrar,
    });
  }

  return uso;
}
