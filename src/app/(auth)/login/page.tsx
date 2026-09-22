"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "./acciones";
import { cifra, deshabilitado } from "@/app/ui";
import { MarcaCQS, Wordmark } from "@/app/wordmark";

const ESTADO_INICIAL: EstadoLogin = {};

/**
 * Entrada al sistema.
 *
 * Una sola columna centrada: la marca, y debajo los dos campos. Antes eran dos
 * columnas con un carrusel de frases y un encabezado que explicaba qué hacer.
 * Se retiró todo: quien abre esta pantalla ya sabe qué es Parquivo y viene a
 * empezar su turno, así que explicarle algo es tiempo que se le quita.
 *
 * El fondo es una retícula de plazas vista desde arriba, en líneas finas, que
 * deriva muy despacio. Sale del propio producto y no del catálogo de fondos
 * "futuristas"; y despacio a propósito, porque detrás de un campo de contraseña
 * un fondo que se mueve rápido estorba.
 *
 * Los campos no son cajas: son una línea que se enciende al enfocarse. En un
 * formulario de dos campos eso se lee mejor que dos recuadros, y es el mismo
 * criterio que rige el resto del rediseño.
 */
export default function LoginPage() {
  const [estado, accion, enviando] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <main className="login-lienzo" style={armazon}>
      <div className="login-entra" style={columna}>
        <Wordmark tamano={46} eslogan animado />

        {/* Sin título ni explicación: la marca ya dice dónde está uno, y los dos
            campos dicen qué hacer. Un encabezado que repite lo que el botón ya
            dice es ruido en la única pantalla que todo el mundo ve todos los
            días. */}
        <div style={{ marginTop: "56px" }}>
          <form action={accion} style={{ display: "grid", gap: "24px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={etiqueta}>Correo</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                className="campo-linea"
                style={campo}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={etiqueta}>Contraseña</span>
              {/* Monoespaciada y muy espaciada: los puntos quedan contables, que
                  es lo único que se puede verificar de una contraseña escrita. */}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="campo-linea"
                style={{ ...campo, ...cifra, letterSpacing: ".18em" }}
              />
            </label>

            {estado.error && (
              <p role="alert" style={error}>
                {estado.error}
              </p>
            )}

            <button type="submit" disabled={enviando} style={deshabilitado(entrar, enviando)}>
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p style={pie}>
            ¿Olvidó su contraseña? Comuníquese con el administrador de la plataforma.
          </p>
        </div>
      </div>

      {/* Esta pantalla no pasa por el armazón con barra lateral, así que lleva
          la marca por su cuenta. */}
      <span className="marca-agua">
        <MarcaCQS />
      </span>
    </main>
  );
}

const armazon: React.CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  padding: "48px 24px",
  boxSizing: "border-box",
};

/** Acotada, porque un formulario ancho se lee peor, no mejor. */
const columna: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "360px",
  maxWidth: "100%",
};

const etiqueta: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
};

const campo: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  color: "var(--texto)",
};

const entrar: React.CSSProperties = {
  marginTop: "6px",
  padding: "15px",
  borderRadius: "11px",
  border: "1px solid transparent",
  background: "var(--boton-fondo)",
  color: "var(--boton-texto)",
  fontSize: "16px",
  fontWeight: 800,
  font: "inherit",
  fontFamily: "inherit",
  cursor: "pointer",
};

const error: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "var(--error-texto)",
};

const pie: React.CSSProperties = {
  margin: "26px 0 0",
  fontSize: "12px",
  lineHeight: 1.6,
  color: "var(--texto-tenue)",
  textAlign: "center",
};
