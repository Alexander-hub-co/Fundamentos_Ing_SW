import { and, eq, gt, isNull, or } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { convenio, convenioPlaca } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import type { ConvenioAplicable } from "@/dominio/tarifas/modelos";
import { diaDeAplicacion } from "./dia";
import { normalizarPlaca } from "@/dominio/vehiculos/placa";

/**
 * Qué convenios entran en juego para una placa en un instante dado (FR-019).
 *
 * Es el contrato que consumirá la taquilla, y ya lo consume el comprobador: no
 * se deja como función escrita y sin llamar. Este proyecto tuvo funciones de
 * dominio completas y probadas que nadie invocaba, y el síntoma fue una brecha
 * de seguridad que ninguna prueba veía.
 *
 * Devuelve las dos listas SEPARADAS porque se usan distinto: los automáticos se
 * aplican solos y los de sello necesitan que alguien confirme, con un botón por
 * cada uno. Que la pantalla salga de este dato es lo que hace que declarar un
 * convenio nuevo baste para que su botón aparezca, sin tocar código.
 *
 * Ninguna de las dos lleva la cuenta de aplicaciones previas: eso lo aporta
 * quien llama. Hoy el comprobador la escribe a mano; mañana la taquilla la saca
 * del historial de movimientos.
 */
export type ConveniosAplicables = {
  /** Se aplican solos: la placa está en su lista. */
  automaticos: Omit<ConvenioAplicable, "aplicacionesPreviasHoy">[];
  /** Requieren que alguien confirme el sello en la taquilla. */
  porSello: Omit<ConvenioAplicable, "aplicacionesPreviasHoy">[];
  /**
   * Contra qué día se cuentan los límites diarios, en la zona del
   * establecimiento. Va acá para que la taquilla no tenga que deducirlo y para
   * que el comprobador pueda mostrarlo: es lo que vuelve visible la regla de la
   * medianoche.
   */
  dia: string;
};

export async function conveniosAplicables(
  contexto: Contexto,
  placaBruta: string | null,
  momento: Date,
  /**
   * Si el vehículo es una bicicleta.
   *
   * Cambia QUÉ convenios entran: los declarados para carros no alcanzan a las
   * bicicletas salvo que el administrador lo haya encendido en ese convenio.
   * Un convenio se pactó pensando en los carros del comercio de al lado, y
   * extenderlo solo regalaría dinero en silencio.
   */
  esBicicleta = false,
): Promise<ConveniosAplicables> {
  exigir(contexto, "parqueadero.ver.propio");
  const dia = diaDeAplicacion(momento);

  if (contexto.tipo !== "establecimiento") return { automaticos: [], porSello: [], dia };

  const placa = placaBruta === null ? null : normalizarPlaca(placaBruta);

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    // Vigente en ESE instante, no hoy: la vigencia se evalúa cuando se cobra.
    const vigente = and(
      eq(convenio.activo, true),
      or(isNull(convenio.hasta), gt(convenio.hasta, momento)),
      // Una bicicleta sólo ve los convenios que el administrador marcó para
      // ellas. Un carro los ve todos: la marca amplía, nunca restringe.
      esBicicleta ? eq(convenio.aplicaBicicletas, true) : undefined,
    );

    const porSello = await tx
      .select()
      .from(convenio)
      .where(and(vigente, eq(convenio.activacion, "sello")));

    const automaticos =
      placa === null || placa.length === 0
        ? []
        : (
            await tx
              .select({ c: convenio })
              .from(convenioPlaca)
              .innerJoin(convenio, eq(convenio.id, convenioPlaca.convenioId))
              .where(and(eq(convenioPlaca.placa, placa), vigente))
          ).map((f) => f.c);

    return { automaticos: automaticos.map(aAplicable), porSello: porSello.map(aAplicable), dia };
  });
}

/** De la fila al dato que el cálculo necesita. Nada más viaja. */
function aAplicable(c: typeof convenio.$inferSelect): Omit<ConvenioAplicable, "aplicacionesPreviasHoy"> {
  return {
    id: c.id,
    nombre: c.nombre,
    activacion: c.activacion,
    beneficio: c.beneficio,
    valor: c.valor,
    topePesos: c.topePesos,
    limiteDiario: c.limiteDiario,
  };
}
