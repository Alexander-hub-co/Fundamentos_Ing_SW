import { asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { capacidad, correccion, movimiento, tipoVehiculo } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/**
 * Quiénes están adentro y cuántos caben.
 *
 * Es la primera vez que la capacidad declarada sirve para algo: la fase
 * anterior la guardaba y no había nada contra qué contrastarla.
 *
 * El conteo sale de los movimientos sin salida registrada, no de un contador
 * aparte. Un contador podría discrepar del historial sin que nada avisara, y
 * entonces habría dos verdades sobre cuántos carros hay adentro.
 */
export type Ocupacion = {
  total: number;
  /** Suma de las capacidades declaradas. Nulo si ningún tipo declaró la suya. */
  cupos: number | null;
  porTipo: { nombre: string; adentro: number; cupos: number | null }[];
};

export async function ocupacionActual(contexto: Contexto): Promise<Ocupacion> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return { total: 0, cupos: null, porTipo: [] };

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const [tipos, adentro, declarada] = await Promise.all([
      tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)),
      tx
        .select({ tipoVehiculoId: movimiento.tipoVehiculoId })
        .from(movimiento)
        .where(isNull(movimiento.salidaEn)),
      tx.select().from(capacidad),
    ]);

    const cuenta = new Map<string, number>();
    for (const m of adentro) cuenta.set(m.tipoVehiculoId, (cuenta.get(m.tipoVehiculoId) ?? 0) + 1);

    const cupoDe = new Map(declarada.map((c) => [c.tipoVehiculoId, c.cupos]));

    const porTipo = tipos.map((t) => ({
      nombre: t.nombre,
      adentro: cuenta.get(t.id) ?? 0,
      // Nulo y no cero: un tipo sin capacidad declarada no tiene un máximo de
      // cero, tiene un máximo que nadie dijo. Inventarlo haría que la pantalla
      // avisara de un desborde que no existe.
      cupos: cupoDe.get(t.id) ?? null,
    }));

    const cupos = declarada.length > 0 ? declarada.reduce((n, c) => n + c.cupos, 0) : null;

    return { total: adentro.length, cupos, porTipo };
  });
}

/** Los vehículos que están adentro, para el panel lateral de la taquilla. */
export type VehiculoAdentro = {
  id: string;
  /** Nula en las bicicletas, que se identifican por ficha. */
  placa: string | null;
  fichaNumero: number | null;
  tipoNombre: string;
  entradaEn: Date;
};

export async function vehiculosAdentro(contexto: Contexto): Promise<VehiculoAdentro[]> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const filas = await tx
      .select({
        id: movimiento.id,
        placa: movimiento.placa,
        fichaNumero: movimiento.fichaNumero,
        entradaEn: movimiento.entradaEn,
        tipoNombre: tipoVehiculo.nombre,
      })
      .from(movimiento)
      .innerJoin(tipoVehiculo, eq(tipoVehiculo.id, movimiento.tipoVehiculoId))
      .where(isNull(movimiento.salidaEn))
      // El que entró primero arriba: es el que lleva más tiempo y el que más
      // probablemente salga pronto.
      .orderBy(asc(movimiento.entradaEn));

    return filas;
  });
}

/**
 * Los últimos cobros cerrados.
 *
 * Existe para poder corregir uno equivocado, y por eso vive en la taquilla y no
 * en una pantalla de reportes: un cobro mal hecho se nota minutos después, con
 * el cliente todavía a la vista. Mandar a quien atiende a otra pantalla para
 * arreglar lo que acaba de hacer es la clase de rodeo que termina en un arreglo
 * por fuera del sistema.
 *
 * Es una lectura corta y reciente, no un historial: los reportes son de otra
 * funcionalidad.
 */
export type CobroReciente = {
  id: string;
  codigo: string;
  placa: string | null;
  fichaNumero: number | null;
  salidaEn: Date;
  importe: number;
  cortesiaMotivo: string | null;
  corregidoA: number | null;
};

export async function ultimosCobros(
  contexto: Contexto,
  cuantos = 8,
): Promise<CobroReciente[]> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const filas = await tx
      .select({
        id: movimiento.id,
        codigo: movimiento.codigo,
        placa: movimiento.placa,
        fichaNumero: movimiento.fichaNumero,
        salidaEn: movimiento.salidaEn,
        importe: movimiento.importe,
        cortesiaMotivo: movimiento.cortesiaMotivo,
      })
      .from(movimiento)
      .where(isNotNull(movimiento.salidaEn))
      .orderBy(desc(movimiento.salidaEn))
      .limit(cuantos);

    const corregidos = await tx
      .select({ movimientoId: correccion.movimientoId, importe: correccion.importeCorregido })
      .from(correccion)
      .orderBy(desc(correccion.emitidaEn));

    // La más reciente manda: un movimiento puede corregirse más de una vez.
    const ultimaCorreccion = new Map<string, number>();
    for (const c of corregidos) {
      if (!ultimaCorreccion.has(c.movimientoId)) ultimaCorreccion.set(c.movimientoId, c.importe);
    }

    return filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      placa: f.placa,
      fichaNumero: f.fichaNumero,
      salidaEn: f.salidaEn!,
      importe: f.importe ?? 0,
      cortesiaMotivo: f.cortesiaMotivo,
      corregidoA: ultimaCorreccion.get(f.id) ?? null,
    }));
  });
}
