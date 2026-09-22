import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { asignacion, convenio, convenioPlaca, type Convenio } from "@/db/esquema";
import type {
  ActivacionConvenio,
  BeneficioConvenio,
  PeriodicidadConvenio,
} from "@/db/esquema";
import { NOMBRE_PERIODICIDAD, vencimientoDe } from "./vigencia";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import { normalizarPlaca } from "@/dominio/vehiculos/placa";

export class ConvenioInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ConvenioInvalido";
  }
}

function ambito(contexto: Contexto): string {
  if (contexto.tipo !== "establecimiento") {
    throw new ConvenioInvalido("El contexto no pertenece a ningún establecimiento");
  }
  return contexto.parqueaderoId;
}

export type DatosConvenio = {
  nombre: string;
  activacion: ActivacionConvenio;
  beneficio: BeneficioConvenio;
  /** Minutos, porcentaje o pesos, según el beneficio. Nulo sólo para `sin_cobro`. */
  valor?: number | null;
  /** Cuánto puede descontar como máximo. Nulo o ausente ⇒ sin tope. */
  topePesos?: number | null;
  /**
   * Cuántas veces al día por placa. Nulo ⇒ sin límite, y quien llama debe
   * haberlo elegido a propósito: el formulario no admite dejarlo en blanco.
   */
  limiteDiario?: number | null;
  /**
   * Duración con nombre. Cuando viene, el vencimiento se calcula y `hasta` se
   * ignora: son dos formas de decir lo mismo y una tiene que mandar.
   */
  periodicidad?: PeriodicidadConvenio | null;
  hasta?: Date | null;
  /**
   * Si alcanza también a las bicicletas. Falso por defecto: un convenio se
   * pactó pensando en los carros del comercio de al lado, y extenderlo solo
   * regalaría dinero en silencio.
   */
  aplicaBicicletas?: boolean;
};

/**
 * Qué exige cada beneficio y qué rango admite su valor.
 *
 * Se valida acá además de en el CHECK de la tabla. No es duplicación ociosa:
 * el motor rechaza la fila con una violación de restricción, que es correcta
 * pero ilegible; acá el error sale con palabras que la persona puede corregir.
 */
const EXIGENCIA: Record<
  BeneficioConvenio,
  { pideValor: boolean; minimo?: number; maximo?: number; queEs: string }
> = {
  minutos_gratis: { pideValor: true, minimo: 1, queEs: "los minutos que regala" },
  porcentaje: { pideValor: true, minimo: 1, maximo: 100, queEs: "el porcentaje de descuento" },
  tarifa_fija: { pideValor: true, minimo: 0, queEs: "el importe que se cobra" },
  sin_cobro: { pideValor: false, queEs: "" },
};

/**
 * Declara un convenio (FR-001 a FR-005).
 *
 * Registra además QUIÉN lo declaró. Ése es el mecanismo entero para distinguir
 * un cambio hecho por soporte: cuando el administrador general opera sobre un
 * establecimiento ajeno, su identificador queda en la fila, y un identificador
 * que no pertenece al establecimiento ES la marca. No hace falta una columna
 * que diga "esto lo hizo la plataforma".
 */
export async function declararConvenio(
  contexto: Contexto,
  datos: DatosConvenio,
): Promise<Convenio> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = ambito(contexto);

  const nombre = datos.nombre.trim();
  if (nombre.length === 0) {
    throw new ConvenioInvalido("El convenio necesita un nombre");
  }

  const exigencia = EXIGENCIA[datos.beneficio];
  const valor = datos.valor ?? null;

  if (!exigencia.pideValor) {
    if (valor !== null) {
      throw new ConvenioInvalido(
        "Un convenio sin cobro no lleva ningún valor: no se cobra y ya",
      );
    }
  } else {
    if (valor === null || !Number.isInteger(valor)) {
      throw new ConvenioInvalido(`Indique ${exigencia.queEs}`);
    }
    if (exigencia.minimo !== undefined && valor < exigencia.minimo) {
      throw new ConvenioInvalido(
        `${mayuscula(exigencia.queEs)} no puede ser menor que ${exigencia.minimo}`,
      );
    }
    if (exigencia.maximo !== undefined && valor > exigencia.maximo) {
      throw new ConvenioInvalido(
        `${mayuscula(exigencia.queEs)} no puede pasar de ${exigencia.maximo}`,
      );
    }
  }

  const tope = datos.topePesos ?? null;
  if (tope !== null && (!Number.isInteger(tope) || tope <= 0)) {
    throw new ConvenioInvalido("El tope tiene que ser un importe mayor que cero, o ninguno");
  }

  const limite = datos.limiteDiario ?? null;
  if (limite !== null && (!Number.isInteger(limite) || limite < 1)) {
    // Cero no es "limitado a nada": es un convenio desactivado, y para eso está
    // el estado activo. Decirlo así evita que alguien lo use como apagador.
    throw new ConvenioInvalido(
      "El límite diario tiene que ser al menos una vez. Para que no aplique nunca, desactive el convenio",
    );
  }

  // Una duración con nombre gana sobre una fecha escrita a mano: quien eligió
  // "mensual" ya dijo cuándo vence, y hacerle además escribir la fecha sería
  // pedirle que confirme una cuenta que el sistema hace mejor.
  const periodicidad = datos.periodicidad ?? null;
  const desde = new Date();
  const hasta = periodicidad ? vencimientoDe(desde, periodicidad) : (datos.hasta ?? null);

  return conAmbito(parqueaderoId, async (tx) => {
    const [creado] = await tx
      .insert(convenio)
      .values({
        parqueaderoId,
        nombre,
        activacion: datos.activacion,
        aplicaBicicletas: datos.aplicaBicicletas ?? false,
        beneficio: datos.beneficio,
        valor,
        topePesos: tope,
        limiteDiario: limite,
        periodicidad,
        creadoPor: contexto.usuarioId,
        desde,
        hasta,
      })
      .returning();
    return creado!;
  });
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Agrega una placa a un convenio.
 *
 * Una placa pertenece a un solo convenio por establecimiento: es lo que hace
 * determinista el descuento. El índice único lo impone; acá se traduce el
 * choque a un mensaje que se entiende.
 */
export async function agregarPlaca(
  contexto: Contexto,
  convenioId: string,
  placaBruta: string,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = ambito(contexto);

  const placa = normalizarPlaca(placaBruta);
  if (placa.length === 0) throw new ConvenioInvalido("Escriba una placa");

  await exigirConvenioPropio(contexto, convenioId);

  try {
    await conAmbito(parqueaderoId, (tx) =>
      tx.insert(convenioPlaca).values({ convenioId, parqueaderoId, placa }),
    );
  } catch (error) {
    if (esChoqueDeUnicidad(error)) {
      throw new ConvenioInvalido(
        `La placa ${placa} ya está en un convenio de este establecimiento`,
      );
    }
    throw error;
  }
}

export async function quitarPlaca(
  contexto: Contexto,
  convenioId: string,
  placaBruta: string,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = ambito(contexto);
  await exigirConvenioPropio(contexto, convenioId);

  await conAmbito(parqueaderoId, (tx) =>
    tx
      .delete(convenioPlaca)
      .where(
        and(
          eq(convenioPlaca.convenioId, convenioId),
          eq(convenioPlaca.placa, normalizarPlaca(placaBruta)),
        ),
      ),
  );
}

/**
 * Vence un convenio.
 *
 * No se borra: las placas y el descuento tienen que seguir siendo consultables
 * para explicar un cobro pasado (Principio IV).
 */
export async function vencerConvenio(contexto: Contexto, convenioId: string): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  const parqueaderoId = ambito(contexto);
  await exigirConvenioPropio(contexto, convenioId);

  await conAmbito(parqueaderoId, (tx) =>
    tx
      .update(convenio)
      .set({ activo: false, hasta: new Date() })
      .where(eq(convenio.id, convenioId)),
  );
}

/**
 * ¿Es una violación de unicidad?
 *
 * Drizzle envuelve el error del motor, así que el código de PostgreSQL viaja en
 * `cause` y a veces más abajo. Se recorre la cadena en vez de mirar sólo el
 * primer nivel, que es lo que fallaba: la restricción saltaba bien y el mensaje
 * que llegaba a la pantalla era el crudo de la base.
 */
function esChoqueDeUnicidad(error: unknown): boolean {
  let actual: unknown = error;
  for (let salto = 0; salto < 5 && actual instanceof Error; salto++) {
    if ("code" in actual && (actual as { code?: string }).code === "23505") return true;
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

async function exigirConvenioPropio(contexto: Contexto, convenioId: string): Promise<void> {
  const [propio] = await conAmbito(ambito(contexto), (tx) =>
    tx.select({ id: convenio.id }).from(convenio).where(eq(convenio.id, convenioId)).limit(1),
  );

  if (!propio) throw await errorDeAlcance(contexto, `convenio:${convenioId}`);
}

/**
 * Cómo se lee un convenio, en una línea.
 *
 * Un caso por beneficio y sin rama por defecto: si mañana entra un quinto, esto
 * deja de compilar en vez de describirlo mal en silencio. Es la lección que
 * dejó el tercer modelo de tarifa, que caía en la rama equivocada y se
 * describía como si fuera otro.
 */
export function describirConvenio(c: {
  activacion: ActivacionConvenio;
  beneficio: BeneficioConvenio;
  valor: number | null;
  topePesos: number | null;
  limiteDiario: number | null;
  periodicidad?: PeriodicidadConvenio | null;
}): string {
  const cuando = c.activacion === "sello" ? "Con sello" : "Por placa";

  let que: string;
  switch (c.beneficio) {
    case "minutos_gratis":
      que = `${c.valor} minutos gratis`;
      break;
    case "porcentaje":
      que = `${c.valor} % de descuento`;
      break;
    case "tarifa_fija":
      que = `se cobra $${(c.valor ?? 0).toLocaleString("es-CO")}`;
      break;
    case "sin_cobro":
      que = "no se cobra la salida";
      break;
  }

  const limites = [
    // La duración va primero: es lo que nombra el acuerdo. "Mensual: no se
    // cobra la salida" se reconoce; "no se cobra la salida · mensual" se lee
    // como una nota al pie.
    c.periodicidad ? NOMBRE_PERIODICIDAD[c.periodicidad].toLowerCase() : null,
    c.topePesos !== null ? `hasta $${c.topePesos.toLocaleString("es-CO")}` : null,
    c.limiteDiario !== null
      ? c.limiteDiario === 1
        ? "una vez al día"
        : `${c.limiteDiario} veces al día`
      : null,
  ].filter(Boolean);

  return limites.length > 0 ? `${cuando}: ${que} · ${limites.join(" · ")}` : `${cuando}: ${que}`;
}

/** Los convenios del establecimiento, con sus placas y su descripción. */
export async function conveniosDelEstablecimiento(contexto: Contexto) {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const filas = await tx.select().from(convenio).orderBy(desc(convenio.desde));
    const placas = await tx.select().from(convenioPlaca);

    // Quiénes pertenecen a este establecimiento. La consulta va con ámbito
    // puesto, así que sólo salen los suyos: si el autor de un convenio no está
    // en esta lista, lo declaró alguien de afuera, y eso es soporte. No hace
    // falta una columna que lo diga.
    const propios = new Set(
      (await tx.select({ id: asignacion.usuarioId }).from(asignacion)).map((a) => a.id),
    );

    return filas.map((c) => ({
      ...c,
      descripcion: describirConvenio(c),
      declaradoPorSoporte: c.creadoPor !== null && !propios.has(c.creadoPor),
      placas: placas.filter((p) => p.convenioId === c.id).map((p) => p.placa).sort(),
    }));
  });
}

/**
 * Qué convenio cubre a una placa en un momento dado.
 *
 * INFORMA, no aplica: aplicar es del cobro. Devuelve null si no hay convenio
 * vigente, y el resultado es determinista porque una placa sólo puede estar en
 * un convenio por establecimiento.
 *
 * Devuelve el convenio entero y no un porcentaje: desde que el vocabulario
 * tiene cuatro beneficios, "el descuento de esta placa" ya no es un número.
 */
export async function descuentoParaPlaca(
  contexto: Contexto,
  placaBruta: string,
  momento: Date,
): Promise<Convenio | null> {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return null;

  const placa = normalizarPlaca(placaBruta);

  const [fila] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ c: convenio })
      .from(convenioPlaca)
      .innerJoin(convenio, eq(convenio.id, convenioPlaca.convenioId))
      .where(
        and(
          eq(convenioPlaca.placa, placa),
          eq(convenio.activo, true),
          or(isNull(convenio.hasta), gt(convenio.hasta, momento)),
        ),
      )
      .limit(1),
  );

  return fila?.c ?? null;
}
