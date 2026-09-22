import type { CSSProperties, ReactNode } from "react";
import { Wordmark } from "./wordmark";

/**
 * El armazón de las pantallas que interrumpen (maquetas 11a–11d).
 *
 * Las cuatro son la misma composición: la marca arriba, un bloque que explica
 * qué pasó, y dos salidas al pie. Comparten componente porque comparten
 * PROPÓSITO —alguien se topó con un muro y hay que sacarlo de ahí— y porque una
 * de ellas divergiendo del resto se lee como si el sistema estuviera roto de
 * verdad.
 *
 * Siempre DOS salidas y nunca ninguna: una pantalla de error sin salida obliga
 * a usar el botón de atrás del navegador, que en una taquilla con fila es peor
 * que el error mismo.
 */
export function PantallaDeAviso({
  ancho = 520,
  children,
  acciones,
}: {
  /** El ancho que fija la maqueta para este caso, en píxeles. */
  ancho?: number;
  children: ReactNode;
  acciones: ReactNode;
}) {
  return (
    <main style={lienzo}>
      <div style={{ ...columna, maxWidth: `${ancho}px` }}>
        <Wordmark tamano={30} />
        {children}
        <div style={{ display: "flex", gap: "11px", flexWrap: "wrap", justifyContent: "center" }}>
          {acciones}
        </div>
      </div>
    </main>
  );
}

/**
 * La tarjeta que explica qué pasó.
 *
 * `tono` no es decoración: el rojo dice "esto falló", el ámbar dice "esto no le
 * corresponde". Son cosas distintas y quien las ve necesita distinguirlas antes
 * de leer una palabra.
 */
export function TarjetaDeAviso({
  tono,
  insignia,
  titulo,
  children,
}: {
  tono: "error" | "aviso";
  insignia: string;
  titulo: string;
  children: ReactNode;
}) {
  const esError = tono === "error";

  return (
    <div
      style={{
        width: "100%",
        border: `1px solid ${esError ? "var(--error-borde)" : "var(--borde)"}`,
        borderRadius: "16px",
        background: esError ? "var(--error-fondo)" : "var(--superficie)",
        padding: "26px 28px",
        textAlign: "left",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "3px 10px",
          borderRadius: "999px",
          background: esError ? "var(--error-texto)" : "var(--aviso-fondo)",
          color: esError ? "var(--fondo)" : "var(--aviso-texto)",
        }}
      >
        {insignia}
      </span>

      <h1
        style={{
          margin: "13px 0 8px",
          fontSize: "22px",
          fontWeight: 800,
          color: esError ? "var(--error-texto)" : "var(--texto)",
        }}
      >
        {titulo}
      </h1>

      <div
        style={{
          fontSize: "14px",
          lineHeight: 1.6,
          color: esError ? "var(--error-texto)" : "var(--texto-tenue)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Los botones de estas pantallas son más grandes que los del resto.
 *
 * La maqueta los pone en 48 px de alto, y tiene razón: aquí no hay nada más que
 * pulsar, y a menudo se llega con prisa.
 */
export const accionPrincipal: CSSProperties = {
  minHeight: "48px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 22px",
  borderRadius: "11px",
  border: "1px solid transparent",
  background: "var(--boton-fondo)",
  color: "var(--boton-texto)",
  fontSize: "15px",
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
  font: "inherit",
};

export const accionSecundaria: CSSProperties = {
  ...accionPrincipal,
  background: "var(--fondo)",
  color: "var(--texto)",
  border: "1px solid var(--borde-control)",
  fontWeight: 500,
};

const lienzo: CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  padding: "48px 24px",
  background: "var(--fondo)",
};

const columna: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "26px",
};
