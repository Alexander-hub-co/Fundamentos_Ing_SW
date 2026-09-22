/**
 * Contrato uniforme de error de ámbito (FR-011).
 *
 * Un recurso que pertenece a otro establecimiento y un recurso que no existe
 * deben ser INDISTINGUIBLES para quien pregunta. Si difirieran —en el código,
 * en el mensaje o en el tiempo de respuesta— la aplicación se convertiría en un
 * oráculo: probando identificadores se podría averiguar cuáles existen, que es
 * exactamente la fuga que el Principio I evita en la capa de datos.
 *
 * Por eso existe UN solo error para ambos casos, y ningún camino del código
 * debe elegir entre dos.
 *
 * Este módulo define el error y nada más. Quien lo lanza es `errorDeAlcance()`
 * en `dominio/auditoria/acceso-denegado.ts`, que además deja el asiento que
 * exige FR-005; construir el error a mano se saltaría ese registro.
 */

export class RecursoNoAlcanzable extends Error {
  /** Siempre el mismo texto: no revela por qué no se alcanzó. */
  static readonly MENSAJE = "El recurso no existe o no está disponible";

  constructor(readonly recurso: string) {
    super(RecursoNoAlcanzable.MENSAJE);
    this.name = "RecursoNoAlcanzable";
  }

  /** Código HTTP único para ambos casos. */
  get estado(): number {
    return 404;
  }

  /**
   * Cuerpo de respuesta. Deliberadamente no incluye `recurso`: ese dato es para
   * el registro de auditoría interno, nunca para quien hizo la petición.
   */
  aRespuesta() {
    return { error: RecursoNoAlcanzable.MENSAJE };
  }
}
