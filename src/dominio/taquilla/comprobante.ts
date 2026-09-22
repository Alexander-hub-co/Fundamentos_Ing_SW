import { asc, eq } from "drizzle-orm";
import { conAmbito, comoPlataforma } from "@/db/ambito";
import { movimiento, parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import type { CobroConConvenios } from "@/dominio/tarifas/modelos";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { rotuloDe } from "./rotulo";

/**
 * El comprobante impreso, como DATO.
 *
 * Deliberadamente no es HTML ni sabe nada de impresoras: es lo que va escrito
 * en el papel, y quién lo pinta o por dónde sale es problema de otra capa. Eso
 * permite probar el contenido —que el importe del papel sea el cobrado, que una
 * cortesía diga por qué— sin una impresora de por medio, que es justamente lo
 * que hoy no hay.
 *
 * La misma función sirve para la primera emisión y para reemitir, porque es una
 * LECTURA y no cambia nada. Reimprimir un ticket perdido no puede ser una
 * operación distinta de imprimirlo la primera vez: sería una segunda ruta que
 * podría decir otra cosa que la primera.
 */
export type Comprobante = {
  tipo: "entrada" | "salida";

  establecimiento: {
    nombre: string;
    direccion: string | null;
    ciudad: string | null;
    telefono: string | null;
  };

  /** El código legible del movimiento. Es lo que se dicta por teléfono. */
  codigo: string;
  /**
   * Lo que va grande en el papel: la placa, o "Ficha 7" si es una bicicleta.
   * Se arma con `rotuloDe`, que es donde vive esa decisión.
   */
  rotulo: string;
  placa: string | null;
  fichaNumero: number | null;
  tipoVehiculo: string;

  entradaEn: Date;
  salidaEn: Date | null;

  /** Código de la cuenta que atendió. No el nombre: el papel es angosto. */
  atendio: string | null;

  /** Sólo en la salida. */
  cobro: CobroConConvenios | null;
  importe: number | null;
  minutosDentro: number | null;

  /** Sólo cuando salió sin cobro. */
  cortesia: { motivo: string; omitido: number } | null;

  /** Cuándo se está imprimiendo, que no es cuándo ocurrió el movimiento. */
  emitidoEn: Date;
  /** Verdadero cuando el papel ya había salido antes. */
  reimpresion: boolean;
};

export class ComprobanteNoDisponible extends Error {}

export async function comprobanteDe(
  contexto: Contexto,
  movimientoId: string,
  ahora: Date = new Date(),
): Promise<Comprobante> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") {
    throw new ComprobanteNoDisponible("El contexto no pertenece a ningún establecimiento");
  }

  const fila = await conAmbito(contexto.parqueaderoId, async (tx) => {
    const [encontrada] = await tx
      .select({ mov: movimiento, tipo: tipoVehiculo, local: parqueadero })
      .from(movimiento)
      .innerJoin(tipoVehiculo, eq(tipoVehiculo.id, movimiento.tipoVehiculoId))
      .innerJoin(parqueadero, eq(parqueadero.id, movimiento.parqueaderoId))
      .where(eq(movimiento.id, movimientoId))
      .limit(1);
    return encontrada ?? null;
  });

  if (!fila) throw new ComprobanteNoDisponible("No se encontró el movimiento");

  const { mov, tipo, local } = fila;
  const fichaNumero = mov.fichaNumero;
  const cerrado = mov.salidaEn !== null;

  // La cuenta que atendió vive en la tabla de plataforma, fuera del ámbito, y
  // se pide sólo la suya. Es la misma excepción acotada que ya usa la barra
  // lateral para mostrar quién está trabajando.
  const quien = cerrado ? mov.operarioSalida : mov.operarioEntrada;
  const atendio = quien ? await codigoDeCuenta(quien) : null;

  return {
    tipo: cerrado ? "salida" : "entrada",
    establecimiento: {
      nombre: local.nombre,
      direccion: local.direccion,
      ciudad: local.ciudad,
      telefono: local.telefono,
    },
    codigo: mov.codigo,
    rotulo: rotuloDe({ placa: mov.placa, fichaNumero }),
    placa: mov.placa,
    fichaNumero,
    tipoVehiculo: tipo.nombre,
    entradaEn: mov.entradaEn,
    salidaEn: mov.salidaEn,
    atendio,
    cobro: (mov.cobro as CobroConConvenios | null) ?? null,
    importe: mov.importe,
    minutosDentro: mov.salidaEn
      ? Math.max(0, Math.round((mov.salidaEn.getTime() - mov.entradaEn.getTime()) / 60_000))
      : null,
    cortesia:
      mov.cortesiaMotivo !== null
        ? { motivo: mov.cortesiaMotivo, omitido: mov.cortesiaImporteOmitido ?? 0 }
        : null,
    emitidoEn: ahora,
    reimpresion: mov.comprobante === "emitido",
  };
}

async function codigoDeCuenta(usuarioId: string): Promise<string | null> {
  const [fila] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx.select({ codigo: usuario.codigo }).from(usuario).where(eq(usuario.id, usuarioId)).limit(1),
  );
  return fila?.codigo ?? null;
}

/**
 * Deja constancia de que el papel salió.
 *
 * Es el ÚNICO cambio que el disparador de inmutabilidad permite sobre un
 * movimiento cerrado, y por eso está acotado a esta columna: no toca importes,
 * ni horas, ni la placa.
 *
 * No vuelve atrás. Un comprobante emitido que se reimprime sigue emitido: lo
 * que la columna responde es "¿alguna vez salió el papel?", que es la pregunta
 * que decide si aparece en la lista de pendientes.
 */
export async function marcarComprobanteEmitido(
  contexto: Contexto,
  movimientoId: string,
): Promise<void> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return;

  await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .update(movimiento)
      .set({ comprobante: "emitido" })
      .where(eq(movimiento.id, movimientoId)),
  );
}

export type MovimientoSinComprobante = {
  id: string;
  codigo: string;
  rotulo: string;
  entradaEn: Date;
  salidaEn: Date | null;
  importe: number | null;
};

/**
 * Los movimientos a los que nunca les salió el papel.
 *
 * Existe porque sin ella el aviso se pierde: la impresión falla, quien atiende
 * está con un carro delante, y para cuando puede ocuparse ya llegó el
 * siguiente vehículo y el mensaje desapareció de la pantalla. Sin una lista, el
 * ticket no impreso no se recupera nunca.
 *
 * Se listan tanto los que están adentro como los ya cobrados: al de adentro le
 * falta su ticket de entrada, y al cobrado su recibo.
 */
export async function movimientosSinComprobante(
  contexto: Contexto,
  limite = 20,
): Promise<MovimientoSinComprobante[]> {
  exigir(contexto, "taquilla.consultar");
  if (contexto.tipo !== "establecimiento") return [];

  return conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({
        id: movimiento.id,
        codigo: movimiento.codigo,
        placa: movimiento.placa,
        fichaNumero: movimiento.fichaNumero,
        entradaEn: movimiento.entradaEn,
        salidaEn: movimiento.salidaEn,
        importe: movimiento.importe,
      })
      .from(movimiento)
      .where(eq(movimiento.comprobante, "pendiente"))
      // Del más viejo al más nuevo: el que lleva más tiempo esperando es el que
      // más riesgo corre de que ya nadie se acuerde de él.
      .orderBy(asc(movimiento.entradaEn))
      .limit(limite)
      .then((filas) =>
        filas.map(({ placa, fichaNumero, ...resto }) => ({
          ...resto,
          rotulo: rotuloDe({ placa, fichaNumero }),
        })),
      ),
  );
}
