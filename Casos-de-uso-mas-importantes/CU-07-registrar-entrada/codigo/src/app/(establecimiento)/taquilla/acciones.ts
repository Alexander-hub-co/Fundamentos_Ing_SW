"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import {
  buscarPorCedula,
  resolverPlaca,
  telefonoConocidoDe,
  type Resolucion,
} from "@/dominio/taquilla/resolver";
import {
  cerrarSinFicha,
  recibirBicicleta,
  registrarCortesia,
  registrarEntrada,
  registrarSalida,
} from "@/dominio/taquilla/registrar";
import { abrirSesion, cerrarSesion } from "@/dominio/turnos/sesiones";
import { emitirCorreccion } from "@/dominio/correcciones/emitir";
import {
  comprobanteDe,
  marcarComprobanteEmitido,
} from "@/dominio/taquilla/comprobante";
import { comprobanteHtml } from "./comprobante-html";
import { preferenciasDe } from "@/dominio/preferencias/gestionar";

export type EstadoTaquilla = {
  error?: string;
  ok?: string;
  resolucion?: Resolucion;
  /**
   * El comprobante ya armado, listo para mandar a la impresora.
   *
   * Viaja con el resultado y no se pide aparte a propósito: si el cliente
   * tuviera que hacer una segunda llamada para conseguirlo, esa llamada podría
   * fallar por su cuenta y dejar un movimiento registrado sin papel y sin
   * aviso. Acá, o llega todo o el registro tampoco ocurrió.
   */
  comprobante?: { movimientoId: string; html: string; automatico: boolean };
};

/**
 * Arma el papel de un movimiento recién registrado.
 *
 * Nunca lanza: un fallo armando el comprobante NO puede deshacer un movimiento
 * que ya está registrado. El vehículo entró de verdad, y quedarse sin ticket es
 * un problema mucho menor que perder el registro de que entró. Si falla, el
 * movimiento queda pendiente y aparece en la lista para reimprimir.
 */
async function papelDe(
  contexto: Awaited<ReturnType<typeof contextoActual>>,
  movimientoId: string,
  /**
   * Si el operario pidió el papel en este movimiento concreto.
   *
   * En la salida la decisión se toma con el cliente delante y no una vez en una
   * pantalla de ajustes: hay quien quiere su recibo y quien se va sin él. El
   * ajuste sigue mandando en la entrada, y en la salida es sólo el valor con el
   * que la pregunta aparece marcada.
   */
  pedido?: boolean,
): Promise<EstadoTaquilla["comprobante"]> {
  try {
    const [comprobante, preferencias] = await Promise.all([
      comprobanteDe(contexto, movimientoId),
      preferenciasDe(contexto),
    ]);

    return {
      movimientoId,
      html: comprobanteHtml(comprobante, preferencias.anchoRollo),
      automatico: pedido ?? preferencias.imprimirAuto,
    };
  } catch {
    return undefined;
  }
}

/**
 * Lo que pasa al escribir una placa y pulsar Enter.
 *
 * NO decide entre entrada y salida: se lo pregunta al dominio, que lo deduce.
 * Quien atiende escribe y confirma; nada más.
 */
export async function consultarPlaca(
  _previo: EstadoTaquilla,
  datos: FormData,
): Promise<EstadoTaquilla> {
  const contexto = await contextoActual(await headers());
  const placa = String(datos.get("placa") ?? "");
  // Los sellos llegan cuando se recalcula tras marcar uno. En la primera
  // búsqueda no viene ninguno, que es lo correcto: todavía nadie confirmó nada.
  const sellos = datos.getAll("sello").map(String);

  try {
    return { resolucion: await resolverPlaca(contexto, placa, new Date(), sellos) };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

export async function confirmarEntrada(
  _previo: EstadoTaquilla,
  datos: FormData,
): Promise<EstadoTaquilla> {
  const contexto = await contextoActual(await headers());

  try {
    const mov = await registrarEntrada(contexto, String(datos.get("placa") ?? ""), new Date());
    revalidatePath("/taquilla");
    // El comprobante nace pendiente y se emite aparte: la impresión ocurre en
    // esta máquina y puede fallar sin que eso deba deshacer el registro.
    return { ok: `${mov.placa} adentro · ${mov.codigo}`, comprobante: await papelDe(contexto, mov.id) };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

export async function confirmarSalida(
  _previo: EstadoTaquilla,
  datos: FormData,
): Promise<EstadoTaquilla> {
  const contexto = await contextoActual(await headers());
  const movimientoId = String(datos.get("movimientoId") ?? "");
  const sellos = datos.getAll("sello").map(String);

  try {
    const mov = await registrarSalida(contexto, movimientoId, new Date(), sellos);
    revalidatePath("/taquilla");
    return {
      ok: `${mov.placa ?? "El vehículo"} salió · se cobró $${(mov.importe ?? 0).toLocaleString("es-CO")}`,
      comprobante: await papelDe(contexto, mov.id, datos.get("imprimirSalida") === "si"),
    };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

export async function confirmarCortesia(
  _previo: EstadoTaquilla,
  datos: FormData,
): Promise<EstadoTaquilla> {
  const contexto = await contextoActual(await headers());

  try {
    const mov = await registrarCortesia(
      contexto,
      String(datos.get("movimientoId") ?? ""),
      String(datos.get("motivo") ?? ""),
      new Date(),
    );
    revalidatePath("/taquilla");
    return {
      ok: `${mov.placa ?? "El vehículo"} salió sin cobro · se omitieron $${(mov.cortesiaImporteOmitido ?? 0).toLocaleString("es-CO")}`,
      comprobante: await papelDe(contexto, mov.id, datos.get("imprimirSalida") === "si"),
    };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

/** Con un carro esperando, un error del motor no le sirve a nadie. */
function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar";
}

export type EstadoTurno = { error?: string; ok?: string };

/** Abre el turno de quien está atendiendo. */
export async function accionAbrirTurno(
  _previo: EstadoTurno,
  datos: FormData,
): Promise<EstadoTurno> {
  const contexto = await contextoActual(await headers());

  try {
    const sesion = await abrirSesion(contexto, String(datos.get("turnoId") ?? ""), new Date());
    revalidatePath("/taquilla");
    return { ok: `Turno abierto a las ${hora(sesion.abiertaEn)}` };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

/**
 * Cierra el turno.
 *
 * Se permite con vehículos adentro: son del establecimiento, no del turno.
 */
export async function accionCerrarTurno(
  _previo: EstadoTurno,
  datos: FormData,
): Promise<EstadoTurno> {
  const contexto = await contextoActual(await headers());

  try {
    const sesion = await cerrarSesion(contexto, String(datos.get("sesionId") ?? ""), new Date());
    revalidatePath("/taquilla");
    return { ok: `Turno cerrado a las ${hora(sesion.cerradaEn!)}` };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

const hora = (d: Date) =>
  d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

export type EstadoCorreccion = { error?: string; ok?: string };

/**
 * Corrige un cobro ya cerrado.
 *
 * No modifica el movimiento: escribe un asiento que lo referencia y conserva
 * los dos importes. La autorización la resuelve el dominio; acá sólo se
 * traduce el resultado a algo que se pueda leer.
 */
export async function accionCorregir(
  _previo: EstadoCorreccion,
  datos: FormData,
): Promise<EstadoCorreccion> {
  const contexto = await contextoActual(await headers());
  const importe = Number.parseInt(String(datos.get("importe") ?? ""), 10);

  try {
    await emitirCorreccion(
      contexto,
      String(datos.get("movimientoId") ?? ""),
      Number.isFinite(importe) ? importe : -1,
      String(datos.get("motivo") ?? ""),
    );
    revalidatePath("/taquilla");
    return { ok: "Corrección registrada. El cobro original se conserva." };
  } catch (error) {
    return { error: mensaje(error) };
  }
}


export type EstadoComprobante = {
  error?: string;
  ok?: string;
  comprobante?: { movimientoId: string; html: string; automatico: boolean };
};

/**
 * Vuelve a armar el papel de un movimiento, para imprimirlo o reimprimirlo.
 *
 * Es la MISMA lectura que la primera vez, no una ruta aparte: un ticket
 * reimpreso que dijera algo distinto del original sería peor que no poder
 * reimprimirlo. Lo único que cambia es el sello de "REIMPRESIÓN", que sale
 * cuando el papel ya había salido antes.
 */
export async function accionImprimirComprobante(
  _previo: EstadoComprobante,
  datos: FormData,
): Promise<EstadoComprobante> {
  const contexto = await contextoActual(await headers());
  const movimientoId = String(datos.get("movimientoId") ?? "");

  try {
    const [comprobante, preferencias] = await Promise.all([
      comprobanteDe(contexto, movimientoId),
      preferenciasDe(contexto),
    ]);

    return {
      comprobante: {
        movimientoId,
        html: comprobanteHtml(comprobante, preferencias.anchoRollo),
        // Pedido a mano: se manda a imprimir sin depender del ajuste, que
        // gobierna sólo lo que ocurre solo.
        automatico: true,
      },
    };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

/**
 * Deja constancia de que el papel salió.
 *
 * Lo confirma el CLIENTE, después de que el navegador aceptara el trabajo,
 * porque el servidor no tiene forma de saberlo: la impresora está en la máquina
 * de la taquilla y no le responde a él. Y "el navegador lo aceptó" tampoco es
 * "el papel salió": por eso esto se puede repetir y la lista de pendientes no
 * desaparece hasta que alguien lo confirme.
 */
export async function accionComprobanteEmitido(movimientoId: string): Promise<void> {
  const contexto = await contextoActual(await headers());

  try {
    await marcarComprobanteEmitido(contexto, movimientoId);
    revalidatePath("/taquilla");
  } catch {
    // Que no se pueda anotar no debe romper la pantalla: el movimiento sigue
    // en la lista de pendientes, que es exactamente el estado correcto.
  }
}

// ---------------------------------------------------------------------------
// Bicicletas (F4)
// ---------------------------------------------------------------------------

export type EstadoBicicleta = {
  error?: string;
  ok?: string;
  comprobante?: { movimientoId: string; html: string; automatico: boolean };
  /** Lo que se sabe de la cédula escrita, para no volver a preguntarlo. */
  telefonoConocido?: string | null;
};

/**
 * Recibe una bicicleta.
 *
 * Es una acción aparte y no el campo único, y conviene decir por qué en vez de
 * disimularlo: recibir exige cédula y teléfono, y eso no cabe en un campo de una
 * línea. El Principio III protege la ruta crítica, no la simetría, y la ruta
 * crítica de una bicicleta es la DEVOLUCIÓN, que sí va por el campo único con un
 * dato y Enter.
 */
export async function accionRecibirBicicleta(
  _previo: EstadoBicicleta,
  datos: FormData,
): Promise<EstadoBicicleta> {
  const contexto = await contextoActual(await headers());

  try {
    const mov = await recibirBicicleta(
      contexto,
      {
        nombre: String(datos.get("nombre") ?? ""),
        cedula: String(datos.get("cedula") ?? ""),
        telefono: String(datos.get("telefono") ?? ""),
        nota: String(datos.get("nota") ?? ""),
      },
      new Date(),
    );

    revalidatePath("/taquilla");
    const numero = await numeroDeFichaDe(contexto, mov.id);
    return {
      ok: `Bicicleta adentro · entregue la ficha ${numero}`,
      comprobante: await papelDe(contexto, mov.id),
    };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

/** Qué teléfono dio antes esta cédula. Se consulta al salir del campo. */
export async function accionTelefonoConocido(
  _previo: EstadoBicicleta,
  datos: FormData,
): Promise<EstadoBicicleta> {
  const contexto = await contextoActual(await headers());

  try {
    return { telefonoConocido: await telefonoConocidoDe(contexto, String(datos.get("cedula") ?? "")) };
  } catch {
    // Que no se pueda proponer no debe estorbar: se escribe a mano y ya.
    return { telefonoConocido: null };
  }
}

export type EstadoBusqueda = {
  error?: string;
  encontradas?: {
    movimientoId: string;
    fichaNumero: number | null;
    entradaEn: string;
    notaVehiculo: string | null;
    nombre: string | null;
  }[];
  cedula?: string;
};

/** La vía de recuperación cuando el cliente llegó sin el tarjetón. */
export async function accionBuscarPorCedula(
  _previo: EstadoBusqueda,
  datos: FormData,
): Promise<EstadoBusqueda> {
  const contexto = await contextoActual(await headers());
  const cedula = String(datos.get("cedula") ?? "");

  try {
    const encontradas = await buscarPorCedula(contexto, cedula);
    return {
      cedula,
      encontradas: encontradas.map((e) => ({
        movimientoId: e.movimientoId,
        fichaNumero: e.fichaNumero,
        entradaEn: e.entradaEn.toISOString(),
        notaVehiculo: e.notaVehiculo,
        nombre: e.nombre,
      })),
    };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

/**
 * Cierra un movimiento cuyo tarjetón no volvió.
 *
 * Cobra la permanencia más el valor de reposición que el establecimiento haya
 * declarado, y deja la ficha como perdida en vez de devolverla al conjunto: el
 * tarjetón físico tampoco volvió, y proponerlo otra vez entregaría un número
 * que nadie tiene en la mano.
 */
export async function accionCerrarSinFicha(
  _previo: EstadoTaquilla,
  datos: FormData,
): Promise<EstadoTaquilla> {
  const contexto = await contextoActual(await headers());

  try {
    const mov = await cerrarSinFicha(contexto, String(datos.get("movimientoId") ?? ""), new Date());
    revalidatePath("/taquilla");
    return {
      ok: `Salió sin ficha · se cobró $${(mov.importe ?? 0).toLocaleString("es-CO")}`,
      comprobante: await papelDe(contexto, mov.id),
    };
  } catch (error) {
    return { error: mensaje(error) };
  }
}

async function numeroDeFichaDe(
  contexto: Awaited<ReturnType<typeof contextoActual>>,
  movimientoId: string,
): Promise<number | string> {
  try {
    const c = await comprobanteDe(contexto, movimientoId);
    return c.fichaNumero ?? "—";
  } catch {
    return "—";
  }
}
