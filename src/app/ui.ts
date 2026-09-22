import type { CSSProperties } from "react";

/**
 * Estilos compartidos de los controles.
 *
 * Todos los botones y enlaces de acción llevan recuadro. Un enlace sin
 * contorno, mezclado con el texto, obliga a adivinar dónde se puede hacer clic;
 * el recuadro lo dice sin que haya que probar.
 *
 * Los colores salen de los tokens del tema, así que ambas apariencias funcionan
 * sin escribir un solo color aquí.
 */

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.375rem",
  borderRadius: "9px",
  textDecoration: "none",
  whiteSpace: "nowrap",
  font: "inherit",
  lineHeight: 1.4,
};

/**
 * Acción principal de la pantalla.
 *
 * El peso 800 no es capricho: en las maquetas es lo único que distingue esta
 * acción de la secundaria cuando las dos están en la misma fila, porque el
 * verde ya se usa en otros sitios y el tamaño es casi el mismo.
 */
export const botonPrimario: CSSProperties = {
  ...base,
  padding: "9px 15px",
  fontSize: "14px",
  fontWeight: 800,
  border: "1px solid transparent",
  background: "var(--boton-fondo)",
  color: "var(--boton-texto)",
  cursor: "pointer",
};

/**
 * Acción secundaria: recuadro visible, fondo del lienzo.
 *
 * El contorno usa `--borde-control`, no `--borde`. Acá el recuadro es lo único
 * que distingue un botón de un texto suelto, y para eso WCAG 1.4.11 pide 3:1;
 * el borde decorativo de las tarjetas no llega.
 */
export const botonSecundario: CSSProperties = {
  ...base,
  padding: "7px 13px",
  fontSize: "13px",
  fontWeight: 500,
  borderRadius: "8px",
  border: "1px solid var(--borde-control)",
  background: "var(--fondo)",
  color: "var(--boton-secundario-texto)",
  cursor: "pointer",
};

/**
 * Acción secundaria dentro de un renglón de lista: "Ver ficha", "Ver el
 * establecimiento". Más pequeña porque compite con el nombre de la fila, que es
 * lo que la persona está leyendo.
 */
export const botonMenudo: CSSProperties = {
  ...botonSecundario,
  padding: "5px 11px",
  fontSize: "12px",
};

/** Acción discreta —volver, cerrar sesión—, pero igualmente con recuadro. */
export const botonTenue: CSSProperties = {
  ...botonMenudo,
  color: "var(--texto-tenue)",
};

/** Acción irreversible. */
export const botonPeligro: CSSProperties = {
  ...botonSecundario,
  color: "var(--error-texto)",
  borderColor: "var(--error-borde)",
};

export function deshabilitado(estilo: CSSProperties, si: boolean): CSSProperties {
  return si ? { ...estilo, opacity: 0.55, cursor: "not-allowed" } : estilo;
}

/**
 * Un campo de formulario. **La forma vive en la hoja, no acá.**
 *
 * Antes este objeto traía el borde, el fondo y el radio, y con eso cada campo
 * era un recuadro más en una pantalla que ya era un mosaico de recuadros.
 * Ahora todo control —`input`, `select`, `textarea`— se dibuja en
 * `globals.css` por elemento: una línea que se enciende al enfocarse, como en
 * la pantalla de acceso.
 *
 * Que esté en la hoja no es orden sino necesidad. El estado de foco no se
 * puede escribir en un atributo `style`, y un borde incrustado le gana a
 * cualquier regla: es exactamente el error que rompió cuatro pantallas en este
 * proyecto.
 *
 * Queda lo que no es forma: que llene su contenedor y que herede la letra.
 */
export const campoTexto: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/** Tarjeta: contenedor de contenido, con el borde decorativo. */
/**
 * Un bloque de contenido. **Sin caja.**
 *
 * Llevaba borde, esquinas redondeadas y relleno, y ése era el problema: todo
 * quedaba encerrado en el mismo recuadro gris —el dato importante y la nota al
 * pie— así que ningún recuadro significaba nada. Un contenedor que se usa para
 * todo deja de separar.
 *
 * Lo que separa ahora es el ESPACIO, y una línea de un píxel donde de verdad
 * hace falta marcar un corte. El fondo del lienzo tiene grano, así que el
 * bloque se distingue sin necesidad de rellenarlo.
 *
 * Queda `superficie` para lo que de verdad es un objeto —una fila que se puede
 * tocar, un aviso que interrumpe—, y ahí la caja sí significa algo.
 */
export const tarjeta: CSSProperties = {
  padding: "2px 0 0",
};

/**
 * Un objeto de verdad: algo que se toca, se abre o interrumpe.
 *
 * Lleva contorno pero NO relleno. El contorno dice "esto es una pieza"; el
 * relleno no añadía nada y era lo que convertía la pantalla en un mosaico de
 * rectángulos grises.
 */
export const pieza: CSSProperties = {
  border: "1px solid var(--borde)",
  borderRadius: "12px",
  padding: "14px 16px",
};

/** Un corte entre dos grupos. Reemplaza a encerrar cada uno en su caja. */
export const corte: CSSProperties = {
  borderTop: "1px solid var(--borde)",
  paddingTop: "18px",
  marginTop: "18px",
};

/** Insignia de estado. El relleno lleva color; encima siempre va el azul. */
export const insignia: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.5rem",
  borderRadius: "999px",
  whiteSpace: "nowrap",
};

/**
 * Escala tipográfica del rediseño.
 *
 * Vive acá y no repetida en cada pantalla porque el handoff la fija como
 * sistema: un tamaño suelto en una pantalla la saca del conjunto sin que nada
 * falle, y esos son los desajustes que nadie corrige después.
 */

/** Título de pantalla. Uno por página. */
export const tituloPantalla: CSSProperties = {
  fontSize: "34px",
  fontWeight: 800,
  /* Apretada de verdad. Archivo a peso alto aguanta el ajuste y es lo que hace
     que un título mande en vez de ser el mismo texto un poco más grande. */
  letterSpacing: "-0.035em",
  lineHeight: 1.05,
  margin: "0 0 6px",
};

/**
 * Rótulo de sección: pequeño, en mayúsculas y muy espaciado.
 *
 * Es deliberadamente discreto. Ordena la pantalla sin competir con el título ni
 * con el dato, que es lo que la persona vino a mirar.
 */
/**
 * Rótulo de sección, con filete.
 *
 * La línea que sale del texto y corre hasta el borde reemplaza a encerrar la
 * sección en una caja: marca dónde empieza un grupo sin dibujar cuatro lados.
 * Es además el gesto del "LABS" del logo de CQS, así que la pantalla y la marca
 * hablan igual.
 *
 * Se consigue con `::after` sobre la clase `rotulo-filete`, porque una línea
 * que crece no cabe en un atributo `style`.
 */
export const rotuloSeccion: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
  margin: "0 0 14px",
};

/** El mismo rótulo, con el respiro mayor que piden las columnas anchas. */
export const rotuloSeccionSuelto: CSSProperties = { ...rotuloSeccion, margin: "0 0 11px" };

/** Texto explicativo bajo un título o un rótulo. */
export const textoTenue: CSSProperties = {
  fontSize: "13px",
  color: "var(--texto-tenue)",
  margin: 0,
};

/**
 * Cifras, placas, horas y códigos.
 *
 * Monoespaciada y con cifras de ancho fijo: en columna es lo que permite
 * compararlas de un vistazo sin que el ojo pierda el renglón.
 */
export const cifra: CSSProperties = {
  fontFamily: "var(--fuente-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
};

/** Importe destacado, como el total de un cobro. */
export const importe: CSSProperties = {
  ...cifra,
  fontSize: "22px",
  fontWeight: 800,
};
