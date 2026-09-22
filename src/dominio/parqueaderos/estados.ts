import type { EstadoParqueadero } from "@/db/esquema";

/**
 * Máquina de estados del establecimiento (FR-023, FR-024).
 *
 * Cuatro valores mutuamente excluyentes, un único campo, ninguna bandera de
 * archivado en paralelo. Cada operación evalúa una sola condición, lo que
 * elimina la clase de error donde se chequea un eje y se olvida el otro.
 *
 * Todas las transiciones son MANUALES: no existe ni existirá un proceso
 * automático que cambie el estado. El cobro a los parqueaderos ocurre fuera del
 * sistema —efectivo o transferencia— así que la plataforma no tiene forma de
 * enterarse de que alguien pagó.
 */

/**
 * Matriz completa. Explícita a propósito: un `Record` obliga a declarar los
 * cuatro estados, así que añadir uno nuevo sin decidir sus transiciones es un
 * error de compilación.
 */
const TRANSICIONES: Record<EstadoParqueadero, readonly EstadoParqueadero[]> = {
  activo: ["pendiente", "suspendido", "dado_de_baja"],
  pendiente: ["activo", "suspendido", "dado_de_baja"],
  suspendido: ["activo", "pendiente", "dado_de_baja"],
  // Terminal para la operación. Sólo se sale reactivando explícitamente a
  // activo (FR-041): no se vuelve a "pendiente" ni a "suspendido", porque
  // reactivar es una decisión deliberada de reanudar el servicio.
  dado_de_baja: ["activo"],
};

/** Estados en los que el establecimiento opera con normalidad. */
const OPERATIVOS: readonly EstadoParqueadero[] = ["activo", "pendiente"];

export class TransicionInvalida extends Error {
  constructor(
    readonly desde: EstadoParqueadero,
    readonly hacia: EstadoParqueadero,
  ) {
    super(
      desde === hacia
        ? `El establecimiento ya está en estado "${desde}"`
        : `No se puede pasar de "${desde}" a "${hacia}"`,
    );
    this.name = "TransicionInvalida";
  }
}

export function transicionesPosibles(
  desde: EstadoParqueadero,
): readonly EstadoParqueadero[] {
  return TRANSICIONES[desde];
}

export function puedeTransicionar(
  desde: EstadoParqueadero,
  hacia: EstadoParqueadero,
): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/** Lanza si la transición no está contemplada. */
export function exigirTransicion(
  desde: EstadoParqueadero,
  hacia: EstadoParqueadero,
): void {
  if (!puedeTransicionar(desde, hacia)) {
    throw new TransicionInvalida(desde, hacia);
  }
}

/**
 * ¿El establecimiento opera con normalidad?
 *
 * `pendiente` cuenta como operativo a propósito: es una marca de gestión del
 * administrador general —"me debe, todavía no le corto"— sin consecuencia
 * operativa (FR-024).
 */
export function esOperativo(estado: EstadoParqueadero): boolean {
  return OPERATIVOS.includes(estado);
}

/**
 * ¿Está en modo restringido? (FR-027, FR-028)
 *
 * Puede cerrar los movimientos abiertos y cobrarlos, pero no registrar
 * movimientos nuevos ni tocar configuración y reportes.
 */
export function esRestringido(estado: EstadoParqueadero): boolean {
  return estado === "suspendido";
}

/** ¿Perdió todo acceso? (FR-041) */
export function esTerminal(estado: EstadoParqueadero): boolean {
  return estado === "dado_de_baja";
}
