import { pgEnum } from "drizzle-orm/pg-core";
import { ACENTOS, DENSIDADES, TEMAS } from "@/dominio/preferencias/valores";

/**
 * Estado del establecimiento. Cuatro valores mutuamente excluyentes: no existe
 * ninguna bandera de archivado en paralelo, de modo que cada operación evalúa
 * una sola condición. Ver FR-023 y la clarificación de la sesión 2026-08-15.
 *
 *   activo        opera con normalidad
 *   pendiente     opera igual que activo; es una marca de gestión del
 *                 administrador general ("me debe, todavía no le corto")
 *   suspendido    modo restringido: cierra lo abierto, no toma trabajo nuevo
 *   dado_de_baja  terminal para la operación; sólo se sale reactivando
 */
export const estadoParqueadero = pgEnum("estado_parqueadero", [
  "activo",
  "pendiente",
  "suspendido",
  "dado_de_baja",
]);

/** Los tres roles que exige FR-002. Ni uno más. */
export const rolUsuario = pgEnum("rol_usuario", [
  "admin_general",
  "admin_parqueadero",
  "operario",
]);

export type EstadoParqueadero = (typeof estadoParqueadero.enumValues)[number];
export type RolUsuario = (typeof rolUsuario.enumValues)[number];

/**
 * Los dos modelos de cobro (F2, FR-001).
 *
 * No son variantes del mismo: se calculan distinto y se topan distinto.
 *
 *   por_minuto     minutos × valor, acotado por una tarifa mínima abajo y una
 *                  plena arriba. Es como se cobran carros y motos en Colombia.
 *   por_intervalo  cualquier fracción de intervalo cobra el intervalo entero,
 *                  con la plena aplicada por jornada. Es el de las bicicletas.
 *   primera_hora_y_fraccion
 *                  un precio fijo por la primera hora y después bloques; el
 *                  resto del tiempo se cobra por fracciones. También frecuente
 *                  en Colombia.
 *
 * Agregar un tercero es agregar un valor acá, sus columnas, su CHECK y su
 * entrada en el mapa de despacho. Los existentes no se tocan: es lo que exige
 * el Principio II.
 */
export const modeloCobro = pgEnum("modelo_cobro", [
  "por_minuto",
  "por_intervalo",
  "primera_hora_y_fraccion",
]);

/**
 * Qué tramo topa la tarifa plena (FR-031).
 *
 *   estadia   la plena es el máximo de toda la permanencia, dure lo que dure
 *   jornada   la plena se reinicia en cada jornada tarifaria
 *
 * Se declara siempre, sin valor por defecto: es la diferencia entre que un
 * carro guardado tres días pague una plena o tres, y quien vende el servicio
 * tiene que haberlo decidido a conciencia.
 */
export const alcancePlena = pgEnum("alcance_plena", ["estadia", "jornada"]);

/**
 * Cuándo aplica un convenio (FR-001).
 *
 *   sello   alguien lo confirma en la taquilla, en el momento de la salida,
 *           porque el cliente trae el ticket sellado por un comercio aliado
 *   placa   la placa figura en la lista del convenio
 *
 * Son dos y no tres. Se consideró una activación que aplicara a todos los
 * vehículos —para promociones de temporada— y se descartó: ningún acuerdo real
 * la pedía, y el Principio V prohíbe construir lo que cabe en el modelo pero
 * nadie necesita.
 */
export const activacionConvenio = pgEnum("activacion_convenio", ["sello", "placa"]);

/**
 * Qué hace el convenio (FR-002).
 *
 *   minutos_gratis  regala tiempo; se resta de los minutos COBRABLES antes de
 *                   aplicar la tarifa, porque una hora no equivale a un monto
 *                   fijo cuando puede entrar la plena o la mínima
 *   porcentaje      descuenta un tanto por ciento del total
 *   tarifa_fija     se cobra un monto y punto, sin calcular
 *   sin_cobro       no se cobra la salida; es la forma de la mensualidad
 *
 * Los dos últimos determinan el total por sí solos: cortocircuitan el cálculo
 * y dejan sin efecto a los beneficios de tiempo.
 */
export const beneficioConvenio = pgEnum("beneficio_convenio", [
  "minutos_gratis",
  "porcentaje",
  "tarifa_fija",
  "sin_cobro",
]);

/**
 * Cómo redondea sus totales un establecimiento (FR-011).
 *
 *   peso         sin redondeo más allá del peso entero
 *   cincuentena  a los cincuenta pesos
 *   centena      a los cien pesos
 *
 * Es configuración y no una constante porque el Principio II nombra las reglas
 * de redondeo entre lo que cada parqueadero decide. Las dos últimas existen
 * porque en Colombia apenas circulan monedas por debajo de cincuenta pesos y un
 * parqueadero no puede devolver un sencillo que no tiene.
 *
 * Ninguna sube el total: el redondeo puede favorecer al cliente, nunca al
 * establecimiento.
 */
export const reglaRedondeo = pgEnum("regla_redondeo", ["peso", "cincuentena", "centena"]);

/**
 * Cuánto dura un convenio, dicho con el nombre que usa el negocio (FR-005a).
 *
 * Existe porque un administrador piensa en "la mensualidad del vecino", no en
 * "vence el 19 de septiembre". Pedirle que traduzca lo uno en lo otro es
 * pedirle que haga a mano una cuenta que el sistema hace solo.
 *
 * Es también la respuesta a un problema que estuvimos a punto de resolver con
 * un modelo de lenguaje: la variedad de los convenios parecía inabarcable y
 * resultó ser una lista. Una variedad acotada se enumera.
 */
export const periodicidadConvenio = pgEnum("periodicidad_convenio", [
  "mensual",
  "trimestral",
  "semestral",
  "anual",
]);

export type PeriodicidadConvenio = (typeof periodicidadConvenio.enumValues)[number];
/**
 * Si el comprobante del movimiento llegó a salir.
 *
 * Existe porque la impresión ocurre en la máquina de la taquilla, no en el
 * servidor, así que registrar el movimiento y emitir el papel son dos pasos y
 * el segundo puede fallar. Un movimiento pendiente NO es un error: es trabajo
 * por hacer, y por eso hay que poder listarlos.
 */
export const estadoComprobante = pgEnum("estado_comprobante", ["pendiente", "emitido"]);

/** Qué operaciones puede delegar un administrador. Lista CERRADA. */
export const operacionDelegable = pgEnum("operacion_delegable", ["emitir_correccion"]);

export type EstadoComprobante = (typeof estadoComprobante.enumValues)[number];
export type OperacionDelegable = (typeof operacionDelegable.enumValues)[number];
export type ModeloCobro = (typeof modeloCobro.enumValues)[number];
export type AlcancePlena = (typeof alcancePlena.enumValues)[number];
export type ActivacionConvenio = (typeof activacionConvenio.enumValues)[number];
export type BeneficioConvenio = (typeof beneficioConvenio.enumValues)[number];
export type ReglaRedondeo = (typeof reglaRedondeo.enumValues)[number];

/**
 * Preferencias visuales de una cuenta. Todas listas CERRADAS: la apariencia se
 * elige entre opciones verificadas, no se escribe.
 *
 * Las listas vienen del dominio y no se repiten acá. El formulario de Ajustes
 * es un componente de cliente y necesita las mismas opciones; si cada lado
 * tuviera la suya, agregar un acento en uno y olvidarlo en el otro fallaría
 * recién al guardar.
 */
export const temaVisual = pgEnum("tema_visual", TEMAS);
export const acentoVisual = pgEnum("acento_visual", ACENTOS);
export const densidadTaquilla = pgEnum("densidad_taquilla", DENSIDADES);

export type { AcentoVisual, DensidadTaquilla, TemaVisual } from "@/dominio/preferencias/valores";
