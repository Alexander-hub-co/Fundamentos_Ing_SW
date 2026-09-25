import { and, eq, isNull } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { movimiento, tipoVehiculo, type Movimiento } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import { clasificarPorPlaca, CODIGO_DE_CLASE } from "@/dominio/vehiculos/clasificar";
import { siguienteCodigoDeMovimiento } from "./codigo";
import { calcularCobroDe } from "./resolver";
import { sesionAbiertaDe } from "@/dominio/turnos/sesiones";
import { tomarFichaLibre } from "@/dominio/fichas/asignar";

export class TaquillaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "TaquillaInvalida";
  }
}

function ambito(contexto: Contexto): string {
  if (contexto.tipo !== "establecimiento") {
    throw new TaquillaInvalida("Este contexto no pertenece a ningún establecimiento");
  }
  return contexto.parqueaderoId;
}

/**
 * Registra la entrada de un vehículo.
 *
 * UN SOLO DATO: la placa. El tipo se deriva de ella y nadie lo elige, que es lo
 * que la constitución exige. El código legible y la sesión de turno se resuelven
 * solos.
 *
 * NO intenta imprimir nada. El comprobante nace `pendiente` y se emite aparte,
 * porque la impresión ocurre en la máquina de la taquilla y puede fallar sin
 * que eso deba impedir que el vehículo quede registrado: ya está físicamente en
 * la puerta, y negarle la entrada no lo hace desaparecer, sólo lo deja sin
 * registro.
 */
export async function registrarEntrada(
  contexto: Contexto,
  bruta: string,
  ahora: Date,
): Promise<Movimiento> {
  // `taquilla.entrada` NO está entre las permitidas en modo restringido, así
  // que un establecimiento suspendido deja de recibir vehículos sin que haya
  // que comprobarlo acá. Salir sí sigue permitido, y por eso son dos
  // operaciones distintas.
  exigir(contexto, "taquilla.entrada");
  const parqueaderoId = ambito(contexto);

  const clasificada = clasificarPorPlaca(bruta);
  if (clasificada.tipo === "rechazada") throw new TaquillaInvalida(clasificada.motivo);

  const sesion = await sesionAbiertaDe(contexto, contexto.usuarioId);

  return conAmbito(parqueaderoId, async (tx) => {
    const [tipo] = await tx
      .select({ id: tipoVehiculo.id })
      .from(tipoVehiculo)
      .where(eq(tipoVehiculo.codigo, CODIGO_DE_CLASE[clasificada.clase]))
      .limit(1);

    if (!tipo) throw new TaquillaInvalida("El catálogo de tipos de vehículo está incompleto");

    const codigo = await siguienteCodigoDeMovimiento(tx, parqueaderoId);

    try {
      const [creado] = await tx
        .insert(movimiento)
        .values({
          parqueaderoId,
          codigo,
          placa: clasificada.placa,
          tipoVehiculoId: tipo.id,
          entradaEn: ahora,
          operarioEntrada: contexto.usuarioId,
          sesionEntrada: sesion?.id ?? null,
        })
        .returning();
      return creado!;
    } catch (error) {
      // El índice parcial es la garantía; acá sólo se traduce a algo que quien
      // atiende pueda leer con un carro esperando.
      if (esChoqueDeUnicidad(error)) {
        throw new TaquillaInvalida(`La placa ${clasificada.placa} ya está adentro`);
      }
      throw error;
    }
  });
}

/** Cierra el movimiento cobrando. */
export async function registrarSalida(
  contexto: Contexto,
  movimientoId: string,
  ahora: Date,
  sellosConfirmados: string[] = [],
): Promise<Movimiento> {
  exigir(contexto, "taquilla.salida");
  const parqueaderoId = ambito(contexto);
  const abierto = await movimientoAbierto(contexto, movimientoId);

  const cobro = await calcularCobroDe(
    contexto as Contexto & { tipo: "establecimiento" },
    abierto,
    ahora,
    sellosConfirmados,
  );

  const sesion = await sesionAbiertaDe(contexto, contexto.usuarioId);

  return conAmbito(parqueaderoId, async (tx) => {
    const [cerrado] = await tx
      .update(movimiento)
      .set({
        salidaEn: ahora,
        operarioSalida: contexto.usuarioId,
        sesionSalida: sesion?.id ?? null,
        importe: cobro.importe,
        // La copia embebida, con valores y no referencias: cambiar una tarifa
        // mañana no puede alterar lo que ya se cobró.
        cobro,
        // El recibo del cobro es OTRO papel que el ticket de entrada, así que
        // vuelve a quedar pendiente aunque el de entrada ya hubiera salido.
        // Sin esto, el recibo no aparecería nunca en la lista de pendientes y
        // un fallo de impresión al cobrar se perdería en silencio.
        comprobante: "pendiente",
      })
      .where(and(eq(movimiento.id, movimientoId), isNull(movimiento.salidaEn)))
      .returning();

    if (!cerrado) throw new TaquillaInvalida("Ese movimiento ya estaba cerrado");
    return cerrado;
  });
}

/**
 * Cierra sin cobrar: el carro del dueño, el del personal, el cliente a quien se
 * le perdona el cobro.
 *
 * Existe porque sin ella quien atiende improvisa —una salida falsa, o un
 * movimiento que se queda abierto para siempre— y las dos ensucian el historial
 * de una forma que después nadie desenreda.
 *
 * Guarda cuánto SE HABRÍA cobrado, calculándolo igual que si fuera a cobrar.
 * Sin ese número no se puede medir lo que las cortesías le cuestan al
 * establecimiento, y entonces no se pueden controlar.
 */
export async function registrarCortesia(
  contexto: Contexto,
  movimientoId: string,
  motivo: string,
  ahora: Date,
): Promise<Movimiento> {
  exigir(contexto, "taquilla.cortesia");
  const parqueaderoId = ambito(contexto);

  const razon = motivo.trim();
  if (razon.length === 0) {
    throw new TaquillaInvalida(
      "Escriba por qué no se cobra. Es lo único que después distingue una decisión de una fuga de caja",
    );
  }

  const abierto = await movimientoAbierto(contexto, movimientoId);

  // Se calcula aunque no se vaya a cobrar: es el dato que hace medible la
  // cortesía. Si no hay tarifa declarada, se registra cero omitido en vez de
  // fallar: negar la salida por eso dejaría el carro adentro.
  const omitido = await calcularCobroDe(
    contexto as Contexto & { tipo: "establecimiento" },
    abierto,
    ahora,
    [],
  )
    .then((c) => c.importe)
    .catch(() => 0);

  const sesion = await sesionAbiertaDe(contexto, contexto.usuarioId);

  return conAmbito(parqueaderoId, async (tx) => {
    const [cerrado] = await tx
      .update(movimiento)
      .set({
        salidaEn: ahora,
        operarioSalida: contexto.usuarioId,
        sesionSalida: sesion?.id ?? null,
        importe: 0,
        cortesiaMotivo: razon,
        cortesiaPor: contexto.usuarioId,
        cortesiaImporteOmitido: omitido,
        // Como en el cobro: el papel de la salida es otro que el de la entrada.
        comprobante: "pendiente",
      })
      .where(and(eq(movimiento.id, movimientoId), isNull(movimiento.salidaEn)))
      .returning();

    if (!cerrado) throw new TaquillaInvalida("Ese movimiento ya estaba cerrado");
    return cerrado;
  });
}

async function movimientoAbierto(contexto: Contexto, movimientoId: string): Promise<Movimiento> {
  const [abierto] = await conAmbito(ambito(contexto), (tx) =>
    tx
      .select()
      .from(movimiento)
      .where(and(eq(movimiento.id, movimientoId), isNull(movimiento.salidaEn)))
      .limit(1),
  );

  if (!abierto) throw await errorDeAlcance(contexto, `movimiento:${movimientoId}`);
  return abierto;
}

/** Drizzle envuelve el código del motor en `cause`, a veces más abajo. */
function esChoqueDeUnicidad(error: unknown): boolean {
  let actual: unknown = error;
  for (let salto = 0; salto < 5 && actual instanceof Error; salto++) {
    if ("code" in actual && (actual as { code?: string }).code === "23505") return true;
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Bicicletas (F4)
// ---------------------------------------------------------------------------

/** Cédula y teléfono normalizados: sólo dígitos, como se comparan después. */
const soloDigitos = (bruto: string) => bruto.replace(/\D/g, "");

export type DatosRecepcion = {
  nombre: string;
  cedula: string;
  telefono: string;
  /** Una seña de la bicicleta. Opcional a propósito: no puede frenar la fila. */
  nota?: string;
};

/**
 * Recibe una bicicleta y le entrega un tarjetón.
 *
 * **Por qué pide dos datos y la entrada de un carro pide uno.** Un carro trae
 * su identificador puesto; una bicicleta no, y el tarjetón que se lo presta se
 * pierde. La cédula es lo que permite devolverle la bicicleta a alguien que
 * llegó sin el papel, que es el caso que ocurre de verdad. Sin ella la única
 * salida sería dejar el movimiento abierto para siempre o inventar una salida
 * falsa.
 *
 * Es una tensión reconocida con el Principio III y está aceptada a la vista, no
 * disimulada: se paga con dos campos el primer día de cada cliente, y la
 * pantalla propone el teléfono conocido cuando la cédula vuelve.
 *
 * La ficha se toma DENTRO de la misma transacción que inserta el movimiento.
 * Tomarla en una y registrar en otra dejaría exactamente la rendija que el
 * índice único cierra.
 */
export async function recibirBicicleta(
  contexto: Contexto,
  datos: DatosRecepcion,
  ahora: Date,
): Promise<Movimiento> {
  exigir(contexto, "taquilla.entrada");
  const parqueaderoId = ambito(contexto);

  const nombre = datos.nombre.trim();
  const cedula = soloDigitos(datos.cedula);
  const telefono = soloDigitos(datos.telefono);

  if (nombre.length < 3) {
    throw new TaquillaInvalida("Escriba el nombre de quien deja la bicicleta");
  }
  if (cedula.length < 5) {
    throw new TaquillaInvalida(
      "Escriba la cédula de quien deja la bicicleta. Es lo que permite devolvérsela si pierde el tarjetón",
    );
  }
  if (telefono.length < 7) {
    throw new TaquillaInvalida("Escriba un teléfono de contacto");
  }

  const sesion = await sesionAbiertaDe(contexto, contexto.usuarioId);

  return conAmbito(parqueaderoId, async (tx) => {
    const [tipo] = await tx
      .select({ id: tipoVehiculo.id })
      .from(tipoVehiculo)
      .where(eq(tipoVehiculo.codigo, "bicicleta"))
      .limit(1);

    if (!tipo) throw new TaquillaInvalida("El catálogo de tipos de vehículo está incompleto");

    // Cuántas fichas hay ES la capacidad de bicicletas declarada: un espacio es
    // una ficha. No se declara aparte para que los dos números no puedan
    // discrepar. La llamada toma además el cerrojo que impide que dos
    // recepciones simultáneas elijan el mismo número.
    const { cupos, numero } = await tomarFichaLibre(tx);
    if (cupos < 1) {
      throw new TaquillaInvalida(
        "Este parqueadero no tiene cupos de bicicleta declarados. Se declaran en Horario y capacidad",
      );
    }

    if (numero === null) {
      // No es un error del programa sino un hecho del local, y se dice así.
      throw new TaquillaInvalida(
        "No hay espacio para más bicicletas. Hay que esperar a que salga una",
      );
    }

    const codigo = await siguienteCodigoDeMovimiento(tx, parqueaderoId);

    try {
      const [creado] = await tx
        .insert(movimiento)
        .values({
          parqueaderoId,
          codigo,
          placa: null,
          fichaNumero: numero,
          nombre,
          cedula,
          telefono,
          notaVehiculo: datos.nota?.trim() || null,
          tipoVehiculoId: tipo.id,
          entradaEn: ahora,
          operarioEntrada: contexto.usuarioId,
          sesionEntrada: sesion?.id ?? null,
        })
        .returning();
      return creado!;
    } catch (error) {
      if (esChoqueDeUnicidad(error)) {
        // Otra taquilla se llevó ese número entre la consulta y la escritura.
        // El índice lo impidió, que es exactamente su trabajo.
        throw new TaquillaInvalida(`La ficha ${numero} acaba de asignarse. Intente otra vez`);
      }
      throw error;
    }
  });
}

/**
 * Devuelve la bicicleta y libera el tarjetón.
 *
 * No hay ninguna función nueva de cobro: es `registrarSalida`, la misma que
 * cierra un vehículo. La ficha vuelve al conjunto por el solo hecho de que el
 * movimiento se cierre, porque "entregada" no se guarda sino que se pregunta.
 * Ésa es la ventaja de no almacenar lo derivable: no hay un segundo sitio que
 * acordarse de actualizar, ni por tanto un segundo sitio que pueda olvidarse.
 */
export const devolverBicicleta = registrarSalida;

/**
 * Cierra la bicicleta de quien perdió su ticket.
 *
 * Es una salida NORMAL: se cobra la permanencia y ya. No hay ningún tarjetón
 * físico que reponer —la ficha es el papel del ticket, no un objeto que el
 * cliente devuelva—, así que perder el papel no le cuesta nada a nadie y el
 * número queda libre igual que en cualquier salida.
 *
 * Existe como función aparte sólo para que la pantalla pueda llegar acá desde
 * la búsqueda por cédula, sin que el operario tenga que averiguar el número.
 */
export async function cerrarSinFicha(
  contexto: Contexto,
  movimientoId: string,
  ahora: Date,
): Promise<Movimiento> {
  return registrarSalida(contexto, movimientoId, ahora);
}
