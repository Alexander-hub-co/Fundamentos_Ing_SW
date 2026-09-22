import { sql } from "drizzle-orm";
import { conAmbito, type Tx } from "@/db/ambito";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/**
 * Los números de ficha.
 *
 * **Una ficha es el ticket, no un tarjetón.** Es el mismo papel que sale para
 * un carro, que en vez de una placa lleva un número. No hay nada físico que el
 * cliente devuelva, así que no hay inventario que administrar, ni estados, ni
 * bajas, ni reposiciones.
 *
 * Y cuántas hay no se declara aparte: **es la capacidad de bicicletas** que el
 * establecimiento ya declaró en horario y capacidad. Un espacio de bicicleta es
 * una ficha. Declararlo dos veces habría abierto la posibilidad de que los dos
 * números no coincidieran, y entonces el sistema entregaría fichas para las que
 * no hay dónde parquear, o dejaría espacios sin usar.
 */

export type ConteoFichas = {
  /** Números libres ahora mismo. */
  disponibles: number;
  /** La capacidad declarada de bicicletas. Cero si no se declaró ninguna. */
  total: number;
};

/** Cuántas bicicletas caben y cuántos números quedan libres. */
export async function fichasDisponibles(contexto: Contexto): Promise<ConteoFichas> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return { disponibles: 0, total: 0 };

  const [fila] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.execute<ConteoFichas>(sql`
      select
        coalesce(c.cupos, 0) as total,
        greatest(
          coalesce(c.cupos, 0) - (
            select count(*) from movimiento m
             where m.salida_en is null and m.ficha_numero is not null
          ),
          0
        )::int as disponibles
      from tipo_vehiculo t
      left join capacidad c on c.tipo_vehiculo_id = t.id
      where t.codigo = 'bicicleta'
      limit 1
    `),
  ).then((r) => r.rows);

  return fila ?? { disponibles: 0, total: 0 };
}

/**
 * Toma el número libre más bajo, en exclusiva.
 *
 * **Dos operarios recibiendo bicicletas en el mismo segundo es el caso que esto
 * existe para resolver**, y hay dos capas.
 *
 * La primera es el cerrojo sobre la fila de CAPACIDAD. Elegir un número es
 * leer cuáles están ocupados y escribir uno nuevo, y entre lo uno y lo otro
 * cabe otra transacción: es el mismo problema que el correlativo del código de
 * movimiento, y no el de la placa, que no hay que leer. Sin cerrojo las cinco
 * recepciones simultáneas eligen el 1, el índice único deja pasar una y las
 * otras cuatro le muestran un error al operario con el cliente delante.
 *
 * Se bloquea la fila de capacidad y no un cerrojo de aviso porque es la fila
 * que YA hay que leer —define cuántos números existen— y porque acota la espera
 * a las bicicletas de ese establecimiento: los carros siguen entrando sin
 * enterarse.
 *
 * La segunda capa es el índice único parcial `movimiento_una_ficha_afuera`.
 * Vive en la base y por tanto sobrevive a cualquier código futuro que inserte
 * un movimiento sin pasar por acá. El cerrojo evita el error; el índice es la
 * garantía.
 *
 * Devuelve `{ cupos: 0 }` cuando el establecimiento no declaró capacidad de
 * bicicletas, y `numero: null` cuando está lleno. Ninguno de los dos es un
 * error del programa: son hechos del local, y quien llama los traduce.
 */
export type Asignacion = { cupos: number; numero: number | null };

export async function tomarFichaLibre(tx: Tx): Promise<Asignacion> {
  // El cerrojo va acá, en el `for update`: desde este punto y hasta que la
  // transacción termine, ninguna otra recepción de bicicleta de este
  // establecimiento avanza.
  const capacidad = await tx.execute<{ cupos: number }>(sql`
    select c.cupos
      from capacidad c
      join tipo_vehiculo t on t.id = c.tipo_vehiculo_id
     where t.codigo = 'bicicleta'
     limit 1
     for update of c
  `);

  const cupos = capacidad.rows[0]?.cupos ?? 0;
  if (cupos < 1) return { cupos: 0, numero: null };

  const libre = await tx.execute<{ numero: number }>(sql`
    select n.numero
      from generate_series(1, ${cupos}) as n(numero)
     where not exists (
       select 1 from movimiento m
        where m.ficha_numero = n.numero and m.salida_en is null
     )
     order by n.numero
     limit 1
  `);

  return { cupos, numero: libre.rows[0]?.numero ?? null };
}
