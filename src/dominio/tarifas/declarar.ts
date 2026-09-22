import { and, eq, isNull } from "drizzle-orm";
import { comoPlataforma, conAmbito, type Tx } from "@/db/ambito";
import { tarifa, tipoVehiculo, type Tarifa } from "@/db/esquema";
import type { AlcancePlena, ModeloCobro } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export class TarifaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "TarifaInvalida";
  }
}

export type DatosTarifa = {
  tipoVehiculoId: string;
  modelo: ModeloCobro;
  alcancePlena: AlcancePlena;
  tarifaPlena: number;
  // por_minuto
  tarifaMinima?: number | null;
  valorMinuto?: number | null;
  // por_intervalo
  intervaloMinutos?: number | null;
  valorIntervalo?: number | null;
  // primera_hora_y_fraccion
  valorPrimeraHora?: number | null;
};

/**
 * Validación en la frontera.
 *
 * La base tiene los mismos CHECK y son la garantía real; esto existe para dar
 * un mensaje con significado en vez de un error de integridad que nadie sabe
 * leer. Si alguna vez discrepan, manda la base.
 */
function validar(datos: DatosTarifa): void {
  if (datos.tarifaPlena < 0) {
    throw new TarifaInvalida("La tarifa plena no puede ser negativa");
  }

  if (datos.modelo === "por_minuto") {
    if (datos.tarifaMinima == null || datos.valorMinuto == null) {
      throw new TarifaInvalida(
        "El cobro por minuto necesita tarifa mínima y valor por minuto",
      );
    }
    if (datos.intervaloMinutos != null || datos.valorIntervalo != null) {
      throw new TarifaInvalida(
        "El cobro por minuto no lleva intervalo: esos valores son del otro modelo",
      );
    }
    if (datos.tarifaMinima < 0 || datos.valorMinuto < 0) {
      throw new TarifaInvalida("Los importes no pueden ser negativos");
    }
    if (datos.tarifaMinima > datos.tarifaPlena) {
      throw new TarifaInvalida(
        "La tarifa mínima no puede superar a la plena: ninguna estadía sería cobrable",
      );
    }
    return;
  }

  if (datos.modelo === "primera_hora_y_fraccion") {
    if (
      datos.valorPrimeraHora == null ||
      datos.intervaloMinutos == null ||
      datos.valorIntervalo == null
    ) {
      throw new TarifaInvalida(
        "El cobro de primera hora necesita su precio, la duración del bloque y su valor",
      );
    }
    if (datos.tarifaMinima != null || datos.valorMinuto != null) {
      throw new TarifaInvalida(
        "El cobro de primera hora no lleva valor por minuto: esos valores son de otro modelo",
      );
    }
    if (datos.intervaloMinutos <= 0) {
      throw new TarifaInvalida("La duración del bloque debe ser mayor que cero");
    }
    if (datos.valorPrimeraHora < 0 || datos.valorIntervalo < 0) {
      throw new TarifaInvalida("Los importes no pueden ser negativos");
    }
    return;
  }

  if (datos.intervaloMinutos == null || datos.valorIntervalo == null) {
    throw new TarifaInvalida(
      "El cobro por intervalos necesita duración del intervalo y su valor",
    );
  }
  if (datos.tarifaMinima != null || datos.valorMinuto != null) {
    throw new TarifaInvalida(
      "El cobro por intervalos no lleva valor por minuto: esos valores son del otro modelo",
    );
  }
  if (datos.intervaloMinutos <= 0) {
    throw new TarifaInvalida("La duración del intervalo debe ser mayor que cero");
  }
  if (datos.valorIntervalo < 0) {
    throw new TarifaInvalida("Los importes no pueden ser negativos");
  }
}

/** Escribe la nueva versión cerrando la anterior. Se ejecuta dentro de una tx. */
async function reemplazarVigente(
  tx: Tx,
  parqueaderoId: string,
  datos: DatosTarifa,
  autorId: string,
): Promise<Tarifa> {
  const ahora = new Date();

  // Cerrar y abrir en la misma transacción. No puede existir un instante con
  // dos versiones vigentes ni uno sin ninguna.
  await tx
    .update(tarifa)
    .set({ vigenteHasta: ahora })
    .where(
      and(
        eq(tarifa.parqueaderoId, parqueaderoId),
        eq(tarifa.tipoVehiculoId, datos.tipoVehiculoId),
        isNull(tarifa.vigenteHasta),
      ),
    );

  const [creada] = await tx
    .insert(tarifa)
    .values({
      parqueaderoId,
      tipoVehiculoId: datos.tipoVehiculoId,
      modelo: datos.modelo,
      alcancePlena: datos.alcancePlena,
      tarifaPlena: datos.tarifaPlena,
      tarifaMinima: datos.tarifaMinima ?? null,
      valorMinuto: datos.valorMinuto ?? null,
      intervaloMinutos: datos.intervaloMinutos ?? null,
      valorIntervalo: datos.valorIntervalo ?? null,
      valorPrimeraHora: datos.valorPrimeraHora ?? null,
      vigenteDesde: ahora,
      creadaPor: autorId,
    })
    .returning();

  return creada!;
}

/**
 * Declara la tarifa vigente de un tipo de vehículo (FR-001 a FR-014).
 *
 * NUNCA actualiza una tarifa existente: cierra la vigente e inserta una nueva.
 * Es lo que permite cobrar mañana un vehículo que entró hoy con la tarifa que
 * regía al entrar (Principio IV).
 *
 * El ámbito sale de la sesión. La autorización la exige `exigir()` por su
 * cuenta, y con el establecimiento suspendido la escritura se rechaza: cambiar
 * las reglas es justo lo que el modo restringido impide.
 */
export async function declararTarifa(
  contexto: Contexto,
  datos: DatosTarifa,
): Promise<Tarifa> {
  exigir(contexto, "parqueadero.editar.propio");
  validar(datos);

  if (contexto.tipo !== "establecimiento") {
    throw new TarifaInvalida("El contexto no pertenece a ningún establecimiento");
  }

  const parqueaderoId = contexto.parqueaderoId;

  // El tipo de vehículo vive en el catálogo de plataforma, fuera del ámbito.
  await exigirTipoConocido(datos.tipoVehiculoId);

  return conAmbito(parqueaderoId, (tx) =>
    reemplazarVigente(tx, parqueaderoId, datos, contexto.usuarioId),
  );
}

/**
 * La misma declaración, ejercida por el administrador general sobre un
 * establecimiento ajeno (FR-029).
 *
 * Existe para dar soporte a un cliente que no se maneja bien con el sistema.
 * Queda anotada en la auditoría de uso de privilegio, y el asiento la distingue
 * de un cambio hecho por el propio establecimiento: sin esa distinción, su
 * administrador vería aparecer tarifas que no declaró y sin forma de saber
 * quién lo hizo.
 */
export async function declararTarifaComoPlataforma(
  contexto: Contexto,
  parqueaderoId: string,
  datos: DatosTarifa,
): Promise<Tarifa> {
  exigir(contexto, "parqueadero.editar.cualquiera");
  validar(datos);
  await registrarUsoPrivilegio(contexto, "tarifa.declarar_ajena");
  await exigirTipoConocido(datos.tipoVehiculoId);

  return comoPlataforma("administracion_plataforma", (tx) =>
    reemplazarVigente(tx, parqueaderoId, datos, contexto.usuarioId),
  );
}

async function exigirTipoConocido(tipoVehiculoId: string): Promise<void> {
  const [tipo] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx.select({ id: tipoVehiculo.id }).from(tipoVehiculo).where(eq(tipoVehiculo.id, tipoVehiculoId)).limit(1),
  );

  if (!tipo) throw await errorDeAlcance(null, `tipo_vehiculo:${tipoVehiculoId}`);
}
