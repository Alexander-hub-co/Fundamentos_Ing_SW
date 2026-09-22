"use client";

import { Wordmark } from "@/app/wordmark";
import { useActionState } from "react";
import { cambiarPassword, type EstadoCambio } from "./acciones";
import { LARGO_MINIMO_PASSWORD } from "@/dominio/autenticacion/parametros";
import { campoTexto, tituloPantalla } from "@/app/ui";

const INICIAL: EstadoCambio = {};

export default function CambiarPassword() {
  const [estado, accion, enviando] = useActionState(cambiarPassword, INICIAL);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <div style={{ width: "100%", maxWidth: "22rem" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <Wordmark tamano={30} />
        </div>

        <h1 style={tituloPantalla}>Defina su contraseña</h1>
        <p style={{ margin: "0 0 1.5rem", color: "var(--texto-tenue)", fontSize: "0.9375rem" }}>
          La contraseña que recibió es temporal. Elija una propia para continuar.
        </p>

        <form action={accion} style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Contraseña nueva</span>
            <input name="password" type="password" autoComplete="new-password" required
              minLength={LARGO_MINIMO_PASSWORD} autoFocus style={campoTexto} />
            <span style={{ fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>
              Mínimo {LARGO_MINIMO_PASSWORD} caracteres.
            </span>
          </label>

          <label style={{ display: "grid", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Repítala</span>
            <input name="repetir" type="password" autoComplete="new-password" required
              minLength={LARGO_MINIMO_PASSWORD} style={campoTexto} />
          </label>

          {estado.error && (
            <p role="alert" style={{
              margin: 0, fontSize: "0.875rem", color: "var(--error-texto)",
              background: "var(--error-fondo)", border: "1px solid var(--error-borde)",
              borderRadius: "9px", padding: "0.625rem 0.75rem",
            }}>{estado.error}</p>
          )}

          <button type="submit" disabled={enviando} style={{
            padding: "0.6875rem 1rem", fontSize: "1rem", fontWeight: 600,
            borderRadius: "9px", border: "none",
            cursor: enviando ? "progress" : "pointer",
            background: "var(--boton-fondo)", color: "var(--boton-texto)",
            opacity: enviando ? 0.7 : 1,
          }}>
            {enviando ? "Guardando…" : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}

