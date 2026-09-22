/**
 * Sigla del establecimiento: el prefijo legible de todo lo suyo.
 *
 * "Parqueadero Centro Histórico" da `PCH`, y a partir de ahí sus cuentas se
 * numeran `PCH-001`, `PCH-002`. La idea es que el identificador diga por sí
 * solo a qué local pertenece, sin abrir ninguna ficha: quien administra varios
 * establecimientos distingue de un vistazo a su gente.
 *
 * Reemplaza al código aleatorio anterior (`PQV-A3F7K2`), que era único pero no
 * se podía leer ni recordar ni comparar de un golpe de vista.
 */

/** Largo objetivo. Tres letras bastan para leerse y para no chocar seguido. */
export const LARGO_SIGLA = 3;

/**
 * Palabras que no aportan identidad y se descartan al formar la sigla.
 *
 * "Parqueadero" NO está en la lista, y es deliberado: en "Parqueadero Centro
 * Histórico" la P inicial viene justamente de ahí. Sólo se descartan nexos.
 */
const NEXOS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "EN", "A", "AL"]);

/** Quita acentos y deja sólo letras y espacios. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .trim();
}

/**
 * Deriva la sigla de un nombre.
 *
 * Toma la inicial de cada palabra con significado. Si no alcanzan tres —"El
 * Dorado" sólo da dos— completa con las letras siguientes de la última palabra,
 * que es la que más distingue a un establecimiento de otro. Si el nombre está
 * vacío o no tiene ninguna letra, devuelve `PQV`, la sigla de la plataforma.
 */
export function siglaDe(nombre: string): string {
  const palabras = normalizar(nombre)
    .split(/\s+/)
    .filter((p) => p.length > 0);

  const significativas = palabras.filter((p) => !NEXOS.has(p));
  const usables = significativas.length > 0 ? significativas : palabras;

  if (usables.length === 0) return SIGLA_PLATAFORMA;

  let sigla = usables.map((p) => p[0]!).join("");

  // Faltan letras: se estiran desde la última palabra, saltando su inicial,
  // que ya está puesta.
  if (sigla.length < LARGO_SIGLA) {
    const ultima = usables[usables.length - 1]!;
    sigla += ultima.slice(1);
  }

  return sigla.slice(0, LARGO_SIGLA).padEnd(LARGO_SIGLA, "X");
}

/**
 * Sigla de la propia plataforma, para las cuentas que no pertenecen a ningún
 * establecimiento. Un administrador general queda como `PQV-001`.
 */
export const SIGLA_PLATAFORMA = "PQV";

/**
 * Resuelve el choque entre dos establecimientos con la misma sigla.
 *
 * "Parqueadero Centro Histórico" y "Parqueadero Casa Hernández" dan ambos
 * `PCH`; el segundo pasa a `PCH2`. Se prefiere alargar la sigla antes que
 * cambiarla por otra irreconocible: `PCH2` sigue diciendo de qué local se
 * trata, y quien lo lee entiende que hay dos parecidos.
 */
export function siglaConDesempate(base: string, intento: number): string {
  return intento <= 1 ? base : `${base}${intento}`;
}

/** Valida la forma de una sigla. Útil en fronteras de entrada. */
export function esSiglaValida(sigla: string): boolean {
  return /^[A-Z]{3}[0-9]{0,2}$/.test(sigla);
}

/**
 * Forma del código de una cuenta: sigla, guion y tres dígitos.
 *
 * Los ceros a la izquierda no son adorno: hacen que el orden alfabético
 * coincida con el numérico, así que un listado ordenado por código sale en el
 * orden en que se dieron de alta las personas.
 */
export function codigoDeCuenta(sigla: string, numero: number): string {
  return `${sigla}-${String(numero).padStart(3, "0")}`;
}

export function esCodigoDeCuentaValido(codigo: string): boolean {
  return /^[A-Z]{3}[0-9]{0,2}-[0-9]{3,}$/.test(codigo);
}
