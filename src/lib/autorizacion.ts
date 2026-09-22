import type { Contexto } from "./sesion";
import type { OperacionDelegable, RolUsuario } from "@/db/esquema";

/**
 * Control de autorización por rol, evaluado en el servidor.
 *
 * FR-003 es explícito: "ocultar una opción en la interfaz NUNCA constituye
 * control de acceso". Este módulo existe para que ninguna pantalla decida por
 * su cuenta quién puede qué — la decisión vive en un único lugar, declarada
 * como datos y no dispersa en condicionales.
 *
 * Añadir una operación al producto obliga a declararla acá: el tipo
 * `Operacion` es cerrado, así que olvidarse produce un error de compilación en
 * vez de un agujero silencioso.
 */

export type Operacion =
  // --- Plataforma: sólo el administrador general ---
  | "parqueadero.crear"
  | "parqueadero.editar.cualquiera"
  | "parqueadero.listar.todos"
  | "parqueadero.cambiar_estado"
  | "parqueadero.dar_de_baja"
  | "parqueadero.asignar_administrador"
  | "cuenta.crear"
  | "cuenta.restablecer_password"
  | "cuenta.bloquear"
  | "cuenta.dar_de_baja"
  | "cuenta.anonimizar"
  | "plataforma.resumen"
  // --- Establecimiento ---
  | "parqueadero.ver.propio"
  | "parqueadero.editar.propio"
  /**
   * Abrir las pantallas de ADMINISTRACIÓN del establecimiento.
   *
   * Existe porque `parqueadero.ver.propio` no servía para esto: la tiene
   * también el operario, y con razón —la necesitan las tarifas, los convenios
   * y la política de cobro que usa la taquilla en cada vehículo—. Quitársela
   * habría roto la taquilla entera.
   *
   * Ésta separa las dos cosas: leer los datos con los que se OPERA, que el
   * operario necesita, de abrir las pantallas donde se CONFIGURA el negocio y
   * se ve al equipo, que no.
   *
   * Lo que cierra: Mi parqueadero, Horario y capacidad, Turnos, Operarios y
   * los reportes del establecimiento. La lista de operarios importa
   * especialmente: trae el correo de cada compañero, quién está bloqueado y
   * quién todavía usa contraseña temporal.
   */
  | "establecimiento.administrar.ver"
  | "cuenta.crear.propia"
  | "cuenta.gestionar.propia"
  // --- Taquilla ---
  //
  // El administrador del establecimiento las tiene todas además del operario:
  // hay parqueaderos donde el administrador trabaja en taquilla, y obligarlo a
  // tener dos cuentas para atender un carro sería absurdo.
  // Entrar y salir son operaciones DISTINTAS y no por gusto: con el
  // establecimiento suspendido no puede entrar nadie más, pero los que están
  // adentro tienen que poder salir. Separarlas deja que el modo restringido lo
  // resuelva solo, en vez de una comprobación a mano que alguien olvidará.
  | "taquilla.entrada"
  | "taquilla.salida"
  | "taquilla.consultar"
  | "taquilla.cortesia"
  | "turno.abrir"
  // Ésta es la ÚNICA operación delegable que existe (constitución 1.1.0). El
  // rol base no la incluye para el operario; un administrador puede otorgarla a
  // una persona concreta, y esa comprobación vive acá abajo y no en la pantalla.
  | "movimiento.corregir"
  | "delegacion.otorgar"
  /**
   * Declarar el conjunto de tarjetones de bicicleta, darlos de baja y
   * recuperarlos.
   *
   * Es del administrador y no del operario a propósito: cuántas fichas hay es
   * un hecho del inventario del local, no una decisión de turno. El operario
   * las entrega y las recibe con `taquilla.entrada` y `taquilla.salida`, que ya
   * existen; eso es lo que hace que el modo restringido funcione solo, sin una
   * comprobación aparte que alguien olvidará.
   */
  | "ficha.declarar";

const PERMISOS: Record<Operacion, readonly RolUsuario[]> = {
  "parqueadero.crear": ["admin_general"],
  "parqueadero.editar.cualquiera": ["admin_general"],
  "parqueadero.listar.todos": ["admin_general"],
  "parqueadero.cambiar_estado": ["admin_general"],
  "parqueadero.dar_de_baja": ["admin_general"],
  "parqueadero.asignar_administrador": ["admin_general"],
  "cuenta.crear": ["admin_general"],
  "cuenta.restablecer_password": ["admin_general"],
  "cuenta.bloquear": ["admin_general"],
  "cuenta.dar_de_baja": ["admin_general"],
  "cuenta.anonimizar": ["admin_general"],
  "plataforma.resumen": ["admin_general"],

  "parqueadero.ver.propio": ["admin_parqueadero", "operario"],
  "taquilla.entrada": ["admin_parqueadero", "operario"],
  "taquilla.salida": ["admin_parqueadero", "operario"],
  "taquilla.consultar": ["admin_parqueadero", "operario"],
  "taquilla.cortesia": ["admin_parqueadero", "operario"],
  "turno.abrir": ["admin_parqueadero", "operario"],
  // Por rol, sólo el administrador. Un operario la obtiene por delegación, que
  // se comprueba aparte: quien cobró de menos no debe poder ajustar su propia
  // caja sin que nadie lo haya autorizado.
  "movimiento.corregir": ["admin_parqueadero"],
  "delegacion.otorgar": ["admin_parqueadero"],
  "ficha.declarar": ["admin_parqueadero"],
  "parqueadero.editar.propio": ["admin_parqueadero"],
  "establecimiento.administrar.ver": ["admin_parqueadero", "admin_general"],

  /**
   * Gestión del equipo por el propio establecimiento (F2, US3).
   *
   * El administrador general también las tiene: puede todo lo que puede un
   * administrador de establecimiento, sobre cualquiera. Los roles acumulan.
   */
  "cuenta.crear.propia": ["admin_parqueadero", "admin_general"],
  "cuenta.gestionar.propia": ["admin_parqueadero", "admin_general"],
};

/**
 * Modo restringido (FR-027, FR-028).
 *
 * Con el establecimiento suspendido, sus usuarios pueden cerrar y cobrar lo que
 * ya está abierto, pero no tomar trabajo nuevo ni tocar configuración ni
 * reportes.
 *
 * La lista se declara por lo que SÍ sigue permitido, no por lo que se bloquea.
 * Es deliberado: con una lista de bloqueos, una operación nueva quedaría
 * permitida por omisión, y el olvido abriría el modo restringido en silencio.
 * Así, lo que no esté acá se bloquea.
 */
const PERMITIDAS_EN_MODO_RESTRINGIDO: readonly Operacion[] = [
  "parqueadero.ver.propio",
  /**
   * Mirar los datos de administración sigue permitido; cambiarlos no.
   *
   * Lo exige SC-005: con el establecimiento suspendido se rechaza el alta de
   * una cuenta y se permite consultar el equipo. Es coherente con el resto
   * del modo restringido, que corta OPERAR y CAMBIAR, no leer: quien recibe
   * una suspensión necesita poder mirar su propia configuración para entender
   * qué tiene montado y a quién llamar.
   *
   * Lo que sigue bloqueado es escribir, que va por `parqueadero.editar.propio`
   * y `cuenta.crear.propia`, y ninguna de las dos está en esta lista.
   */
  "establecimiento.administrar.ver",
  // Un establecimiento suspendido no recibe vehículos nuevos, pero los que
  // están adentro tienen que poder salir. Dejarlos atrapados por una decisión
  // administrativa sería inaceptable, así que cerrar y cobrar siguen
  // permitidos —incluida la cortesía, que también es una forma de cerrar—.
  "taquilla.consultar",
  "taquilla.salida",
  "taquilla.cortesia",
];

export class NoAutorizado extends Error {
  constructor(readonly operacion: Operacion) {
    super(`Operación no permitida: ${operacion}`);
    this.name = "NoAutorizado";
  }
}

export class EstablecimientoRestringido extends Error {
  constructor(readonly operacion: Operacion) {
    super(`El establecimiento está suspendido: ${operacion} no disponible`);
    this.name = "EstablecimientoRestringido";
  }
}

export class EstablecimientoDadoDeBaja extends Error {
  constructor() {
    super("El establecimiento fue dado de baja");
    this.name = "EstablecimientoDadoDeBaja";
  }
}

/** ¿El rol de este contexto puede ejecutar la operación? */
export function puede(contexto: Contexto, operacion: Operacion): boolean {
  if (PERMISOS[operacion].includes(contexto.rol)) return true;

  /**
   * Y si el rol no alcanza, puede alcanzarlo una delegación (constitución
   * 1.1.0). Se comprueba ACÁ, en la única puerta de autorización, y no en la
   * pantalla: ocultar un botón nunca constituye control de acceso, y la
   * constitución lo dice con esas palabras.
   *
   * `DELEGABLES` es la lista cerrada que la enmienda exige. Una operación que
   * no esté en ella no se puede delegar por mucho que alguien inserte una fila.
   */
  if (contexto.tipo !== "establecimiento") return false;

  const otorgadas = contexto.delegaciones ?? [];
  return otorgadas.some((d) => OPERACION_DE_DELEGACION[d] === operacion);
}

/**
 * El puente entre los dos vocabularios.
 *
 * La base nombra las delegaciones a su manera —`emitir_correccion`— y la
 * autorización a la suya —`movimiento.corregir`—. Ésta es la ÚNICA
 * correspondencia entre ambos, y está sola para que agregar una delegación
 * futura obligue a tocar un solo sitio y a decidir conscientemente qué
 * operación concede.
 *
 * Es también la lista cerrada que exige la constitución 1.1.0: una delegación
 * que no figure aquí no concede nada, por mucho que alguien inserte la fila.
 */
const OPERACION_DE_DELEGACION: Record<OperacionDelegable, Operacion> = {
  emitir_correccion: "movimiento.corregir",
};


/**
 * Exige autorización antes de ejecutar. Lanza si no corresponde.
 *
 * Se invoca al principio de cada operación de dominio, nunca desde la interfaz:
 * la interfaz puede ocultar el botón por comodidad, pero la decisión de si la
 * operación ocurre se toma acá.
 *
 * El estado del establecimiento sale del propio contexto, no de un parámetro:
 * así el modo restringido no depende de que quien llama se acuerde de pasarlo.
 */
export function exigir(contexto: Contexto, operacion: Operacion): void {
  if (!puede(contexto, operacion)) {
    throw new NoAutorizado(operacion);
  }

  if (contexto.tipo !== "establecimiento") return;

  // Terminal: sin acceso a nada (FR-041).
  if (contexto.estado === "dado_de_baja") {
    throw new EstablecimientoDadoDeBaja();
  }

  if (
    contexto.estado === "suspendido" &&
    !PERMITIDAS_EN_MODO_RESTRINGIDO.includes(operacion)
  ) {
    throw new EstablecimientoRestringido(operacion);
  }
}
