/**
 * Parámetros de la defensa ante adivinación de contraseñas.
 *
 * Viven en un único módulo con nombre, nunca como literales dispersos por el
 * código. Es la vigilancia que el plan anotó sobre el Principio II: aunque
 * estos no sean parámetros de negocio por establecimiento —son de plataforma—,
 * un número suelto en medio de una función es igual de difícil de encontrar y
 * de cambiar.
 *
 * Los valores están fijados en la especificación (FR-006, SC-010), así que
 * cambiarlos acá exige enmendarla también.
 */

/** Intentos fallidos consecutivos sin penalización alguna. */
export const INTENTOS_SIN_PENALIZACION = 3;

/** Espera del primer intento penalizado, en milisegundos. */
export const DEMORA_BASE_MS = 2_000;

/** Factor de crecimiento: 2, 4, 8, 16… */
export const FACTOR_CRECIMIENTO = 2;

/**
 * Tope de la espera, en milisegundos.
 *
 * Es lo que garantiza FR-007: la demora nunca crece sin límite, así que la
 * cuenta jamás queda inaccesible de forma permanente. Un ataque automatizado
 * queda reducido a 2 intentos por minuto (SC-010); un operario que se equivocó
 * espera medio minuto en el peor caso.
 */
export const DEMORA_MAXIMA_MS = 30_000;

/**
 * Ventana hacia atrás para contar intentos fallidos consecutivos.
 *
 * Sin ventana, un fallo de hace un año seguiría contando. Con ella, la cuenta
 * se "olvida" del incidente pasado un tiempo razonable.
 */
export const VENTANA_MINUTOS = 60;

/**
 * Largo mínimo de la contraseña que el usuario define en el cambio obligatorio.
 *
 * Vive aquí, y no junto a la lógica del cambio, porque el formulario del
 * cliente necesita el valor para su validación nativa. Este módulo no importa
 * nada, así que se puede usar tanto en el servidor como en el navegador.
 */
export const LARGO_MINIMO_PASSWORD = 10;

/**
 * Duración de la sesión, en segundos.
 *
 * La especificación dejó este valor diferido en la clarificación del
 * 2026-08-15, así que aquí queda el valor adoptado por defecto y el lugar
 * donde cambiarlo cuando el negocio lo decida.
 *
 * Doce horas cubren un turno completo de taquilla sin obligar a volver a
 * entrar a media jornada, que es la fricción que el Principio III manda evitar.
 */
export const SESION_DURACION_SEGUNDOS = 60 * 60 * 12;

/**
 * Cada cuánto se renueva la sesión activa, en segundos.
 *
 * Sin renovación, un operario a mitad de turno perdería la sesión de golpe al
 * cumplirse la duración; con ella, la sesión se extiende mientras haya uso.
 */
export const SESION_RENOVACION_SEGUNDOS = 60 * 60;

/**
 * Cuántos intentos recientes se examinan al contar fallos consecutivos.
 *
 * Acota el trabajo de la consulta. Con el tope de demora vigente, alcanzar
 * este número de fallos dentro de la ventana es ya inviable para un ataque
 * automatizado, así que el límite no recorta ningún caso real.
 */
export const INTENTOS_EXAMINADOS = 50;
