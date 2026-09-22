import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { movimiento, tipoVehiculo, type Movimiento } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { clasificarPorPlaca, CODIGO_DE_CLASE } from "@/dominio/vehiculos/clasificar";
import { aplicarConvenios } from "@/dominio/convenios/aplicar";
import { conveniosAplicables } from "@/dominio/convenios/consultar";
import { politicaDeCobro } from "@/dominio/cobro/politica";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { aTarifaAplicable, tarifaVigenteEn } from "@/dominio/tarifas/consultar";
import type { CobroConConvenios, ConvenioAplicable } from "@/dominio/tarifas/modelos";
import { aplicacionesPreviasHoy } from "./historial";
import { rotuloDe } from "./rotulo";

/**
 * Lo que pasa cuando alguien escribe una placa.
 *
 * Es la función que hace posible la decisión de diseño más importante de la
 * pantalla: UN SOLO CAMPO resuelve entrada y salida. Quien atiende no elige
 * entre las dos; escribe la placa y el sistema deduce cuál corresponde. Cada
 * clic ahorrado se multiplica por cientos de vehículos al día.
 *
 * Devuelve una de tres cosas y nunca "no sé": una placa que no tiene forma de
 * placa se rechaza explícitamente para que se corrija.
 */
export type Resolucion =
  | {
      tipo: "entrada";
      placa: string;
      tipoVehiculoId: string;
      tipoNombre: string;
      /** Para el aviso de confirmación: qué se le va a cobrar. */
      tarifa: string | null;
      /** Si la placa ya tiene convenio, se nombra en vez del importe. */
      convenio: string | null;
      /** Sin tarifa declarada no se le va a poder cobrar al salir. */
      sinTarifa: boolean;
    }
  | {
      tipo: "salida";
      movimiento: Movimiento;
      /** Cómo se nombra: la placa, o "Ficha 7" si es una bicicleta. */
      rotulo: string;
      /**
       * Lo que hay que volver a escribir en el campo único para llegar a este
       * mismo movimiento: la placa, o el número de ficha a secas.
       *
       * Existe porque el formulario de sellos recalcula reenviando el
       * identificador, y "Ficha 7" no es lo que el campo entiende: entiende 7.
       */
      consulta: string;
      tipoNombre: string;
      minutosDentro: number;
      cobro: CobroConConvenios;
      /** Un control por cada uno: quien atiende confirma el que traiga el ticket. */
      sellos: { id: string; nombre: string; descripcion: string }[];
      /**
       * Cuáles se confirmaron para ESTE cálculo.
       *
       * Viaja de vuelta a propósito: el formulario que cobra los reenvía tal
       * cual, así que el importe que se muestra y el que se cobra salen del
       * mismo conjunto. Dejar que el cobro los recogiera por su cuenta abriría
       * la puerta a que difirieran, y un total distinto del que el operario le
       * dijo al cliente es el peor fallo que puede tener esta pantalla.
       */
      sellosAplicados: string[];
      dia: string;
    }
  | { tipo: "rechazada"; motivo: string };

export async function resolverPlaca(
  contexto: Contexto,
  bruta: string,
  ahora: Date,
  sellosConfirmados: string[] = [],
): Promise<Resolucion> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") {
    return { tipo: "rechazada", motivo: "Este contexto no pertenece a ningún establecimiento" };
  }

  // Un texto de sólo dígitos es un número de ficha; con alguna letra es una
  // placa. No hay solapamiento posible porque una placa sin letras no existe,
  // así que el campo único sigue siendo uno solo, que es lo que el Principio
  // III protege.
  if (esNumeroDeFicha(bruta)) {
    return resolverFicha(contexto, Number(bruta.trim()), ahora, sellosConfirmados);
  }

  const clasificada = clasificarPorPlaca(bruta);
  if (clasificada.tipo === "rechazada") {
    return { tipo: "rechazada", motivo: clasificada.motivo };
  }

  const { placa, clase } = clasificada;

  const adentro = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select()
      .from(movimiento)
      .where(and(eq(movimiento.placa, placa), isNull(movimiento.salidaEn)))
      .limit(1),
  );

  return adentro[0]
    ? resolverSalida(contexto, adentro[0], ahora, sellosConfirmados)
    : resolverEntrada(contexto, placa, clase, ahora);
}

async function resolverEntrada(
  contexto: Contexto & { tipo: "establecimiento" },
  placa: string,
  clase: "carro" | "moto",
  ahora: Date,
): Promise<Resolucion> {
  const codigo = CODIGO_DE_CLASE[clase];

  const [tipo] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.select().from(tipoVehiculo).where(eq(tipoVehiculo.codigo, codigo)).limit(1),
  );

  if (!tipo) {
    return { tipo: "rechazada", motivo: `El catálogo no tiene el tipo «${codigo}»` };
  }

  const [tarifa, aplicables] = await Promise.all([
    tarifaVigenteEn(contexto, tipo.id, ahora),
    conveniosAplicables(contexto, placa, ahora),
  ]);

  return {
    tipo: "entrada",
    placa,
    tipoVehiculoId: tipo.id,
    tipoNombre: tipo.nombre,
    tarifa: tarifa ? describirTarifa(tarifa) : null,
    convenio: aplicables.automaticos[0]?.nombre ?? null,
    sinTarifa: tarifa === null,
  };
}

async function resolverSalida(
  contexto: Contexto & { tipo: "establecimiento" },
  mov: Movimiento,
  ahora: Date,
  sellosConfirmados: string[],
): Promise<Resolucion> {
  const [tipo] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx.select().from(tipoVehiculo).where(eq(tipoVehiculo.id, mov.tipoVehiculoId)).limit(1),
  );

  const cobro = await calcularCobroDe(contexto, mov, ahora, sellosConfirmados);
  // Una bicicleta no tiene placa, así que los convenios por placa no la
  // alcanzan de todos modos; lo que esta bandera decide son los de SELLO, que
  // el cliente sí puede traer en la mano.
  const aplicables = await conveniosAplicables(
    contexto,
    mov.placa,
    ahora,
    mov.fichaNumero !== null,
  );

  const fichaNumero = mov.fichaNumero;

  return {
    tipo: "salida",
    movimiento: mov,
    rotulo: rotuloDe({ placa: mov.placa, fichaNumero }),
    consulta: mov.placa ?? String(fichaNumero ?? ""),
    tipoNombre: tipo?.nombre ?? "Vehículo",
    minutosDentro: Math.ceil((ahora.getTime() - mov.entradaEn.getTime()) / 60_000),
    cobro,
    sellos: aplicables.porSello.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: describirBeneficio(c),
    })),
    sellosAplicados: sellosConfirmados,
    dia: aplicables.dia,
  };
}

/** Sólo dígitos, con espacios alrededor tolerados. Nunca vacío. */
export function esNumeroDeFicha(bruta: string): boolean {
  const limpio = bruta.trim();
  return limpio.length > 0 && limpio.length <= 4 && /^\d+$/.test(limpio);
}

/**
 * Qué hay detrás de un número de ficha.
 *
 * Distingue los tres "no" que el operario necesita diferenciar y que un mensaje
 * genérico confundiría: esa ficha no existe, existe pero está en el mostrador,
 * o existe pero se retiró del conjunto. Cada uno lleva a una acción distinta.
 *
 * A diferencia de una placa, un número de ficha NUNCA resuelve una entrada:
 * recibir una bicicleta exige cédula y teléfono, que no caben en un campo de
 * una línea. Escribir "7" sólo puede significar "devuelvo la ficha 7".
 */
async function resolverFicha(
  contexto: Contexto & { tipo: "establecimiento" },
  numero: number,
  ahora: Date,
  sellosConfirmados: string[],
): Promise<Resolucion> {
  const [abierto] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select()
      .from(movimiento)
      .where(and(eq(movimiento.fichaNumero, numero), isNull(movimiento.salidaEn)))
      .limit(1),
  );

  if (abierto) return resolverSalida(contexto, abierto, ahora, sellosConfirmados);

  return {
    tipo: "rechazada",
    motivo: `No hay ninguna bicicleta con la ficha ${numero}`,
  };
}

/**
 * Los movimientos abiertos de una cédula.
 *
 * Es la vía de recuperación cuando el cliente llegó sin el tarjetón, y la razón
 * por la que se pide la cédula al recibir. Devuelve una lista y no uno solo
 * porque una misma persona puede haber dejado dos bicicletas.
 */
export type BicicletaDeCliente = {
  movimientoId: string;
  fichaNumero: number | null;
  entradaEn: Date;
  notaVehiculo: string | null;
  nombre: string | null;
};

export async function buscarPorCedula(
  contexto: Contexto,
  cedulaBruta: string,
): Promise<BicicletaDeCliente[]> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return [];

  const cedula = cedulaBruta.replace(/\D/g, "");
  if (cedula.length < 5) return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({
        movimientoId: movimiento.id,
        fichaNumero: movimiento.fichaNumero,
        entradaEn: movimiento.entradaEn,
        notaVehiculo: movimiento.notaVehiculo,
        nombre: movimiento.nombre,
      })
      .from(movimiento)
      .where(
        and(
          eq(movimiento.cedula, cedula),
          isNull(movimiento.salidaEn),
          isNotNull(movimiento.fichaNumero),
        ),
      ),
  );
}

/**
 * El teléfono que esa cédula dio la última vez.
 *
 * Es lo que hace que la recepción de un cliente habitual cueste UN dato en vez
 * de dos, y con eso lo que mitiga la tensión con el Principio III. En un
 * parqueadero de bicicletas los clientes son casi siempre los mismos.
 *
 * Devuelve nulo cuando la cédula no aparece, incluido el caso de que su
 * movimiento anterior ya haya perdido los datos personales por retención. Eso
 * es la finalidad cumpliéndose, no un fallo: quien no vuelve en un año da su
 * teléfono otra vez.
 */
export async function telefonoConocidoDe(
  contexto: Contexto,
  cedulaBruta: string,
): Promise<string | null> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return null;

  const cedula = cedulaBruta.replace(/\D/g, "");
  if (cedula.length < 5) return null;

  const [fila] = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ telefono: movimiento.telefono })
      .from(movimiento)
      .where(and(eq(movimiento.cedula, cedula), isNotNull(movimiento.telefono)))
      .orderBy(desc(movimiento.entradaEn))
      .limit(1),
  );

  return fila?.telefono ?? null;
}

/**
 * El cobro de un movimiento en un instante dado.
 *
 * NO reimplementa nada: pide la tarifa, el horario, la regla de redondeo y los
 * convenios a lo que ya existe, y se lo entrega al calculador puro. Lo único
 * que aporta de nuevo es el conteo de aplicaciones previas de cada convenio,
 * que es justo el hueco que el contrato de los convenios dejó señalado y que
 * hasta ahora nadie podía llenar porque no había movimientos.
 */
export async function calcularCobroDe(
  contexto: Contexto & { tipo: "establecimiento" },
  mov: Movimiento,
  salida: Date,
  sellosConfirmados: string[],
): Promise<CobroConConvenios> {
  const [tarifaFila, horario, redondeo, aplicables] = await Promise.all([
    tarifaVigenteEn(contexto, mov.tipoVehiculoId, salida),
    horarioDelCobro(contexto),
    politicaDeCobro(contexto),
    conveniosAplicables(contexto, mov.placa, salida),
  ]);

  if (!tarifaFila) {
    throw new SinTarifa(
      "Este tipo de vehículo no tiene tarifa declarada: no hay sobre qué cobrar",
    );
  }

  const elegidos = new Set(sellosConfirmados);
  const candidatos = [
    ...aplicables.automaticos,
    ...aplicables.porSello.filter((c) => elegidos.has(c.id)),
  ];

  const previas = await aplicacionesPreviasHoy(
    contexto,
    mov.placa,
    aplicables.dia,
    candidatos.map((c) => c.id),
  );

  const convenios: ConvenioAplicable[] = candidatos.map((c) => ({
    ...c,
    aplicacionesPreviasHoy: previas.get(c.id) ?? 0,
  }));

  return aplicarConvenios({
    entrada: mov.entradaEn,
    salida,
    tarifa: aTarifaAplicable(tarifaFila),
    horario,
    convenios,
    redondeo,
  });
}

export class SinTarifa extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "SinTarifa";
  }
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

function describirTarifa(t: { modelo: string; valorMinuto: number | null; valorIntervalo: number | null; intervaloMinutos: number | null; valorPrimeraHora: number | null; tarifaPlena: number }): string {
  switch (t.modelo) {
    case "por_minuto":
      return `${pesos(t.valorMinuto ?? 0)} por minuto · máx ${pesos(t.tarifaPlena)}`;
    case "por_intervalo":
      return `${pesos(t.valorIntervalo ?? 0)} cada ${t.intervaloMinutos} min · máx ${pesos(t.tarifaPlena)}`;
    default:
      return `Primera hora ${pesos(t.valorPrimeraHora ?? 0)} · máx ${pesos(t.tarifaPlena)}`;
  }
}

function describirBeneficio(c: { beneficio: string; valor: number | null }): string {
  switch (c.beneficio) {
    case "minutos_gratis":
      return `${c.valor} min gratis`;
    case "porcentaje":
      return `−${c.valor} %`;
    case "tarifa_fija":
      return `cobra ${pesos(c.valor ?? 0)}`;
    default:
      return "no cobra";
  }
}
