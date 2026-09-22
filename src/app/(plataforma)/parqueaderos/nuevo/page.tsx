"use client";

import Link from "next/link";
import { botonTenue, tituloPantalla } from "@/app/ui";
import { useActionState } from "react";
import { altaParqueadero, type EstadoAlta } from "../acciones";

const ESTADO_INICIAL: EstadoAlta = {};

export default function NuevoParqueadero() {
  const [estado, accion, enviando] = useActionState(altaParqueadero, ESTADO_INICIAL);

  return (
    <>
      <Link href="/parqueaderos" style={botonTenue}>
        ← Volver
      </Link>

      <h1 style={tituloPantalla}>
        Nuevo parqueadero
      </h1>
      <p style={{ color: "var(--texto-tenue)", marginTop: 0 }}>
        El código interno se genera automáticamente y no se puede cambiar después.
      </p>

      <form action={accion} style={{ display: "grid", gap: "1rem", maxWidth: "26rem", marginTop: "1.5rem" }}>
        <Campo nombre="nombre" etiqueta="Nombre" requerido autoFocus />
        <Campo nombre="ciudad" etiqueta="Ciudad" />
        <Campo nombre="direccion" etiqueta="Dirección" />
        <Campo nombre="telefono" etiqueta="Teléfono" tipo="tel" />

        {estado.error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--error-texto)",
              background: "var(--error-fondo)",
              border: "1px solid var(--error-borde)",
              borderRadius: "9px",
              padding: "0.625rem 0.75rem",
            }}
          >
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          style={{
            padding: "0.6875rem 1rem",
            fontSize: "1rem",
            fontWeight: 600,
            borderRadius: "9px",
            border: "none",
            cursor: enviando ? "progress" : "pointer",
            background: "var(--boton-fondo)",
            color: "var(--boton-texto)",
            opacity: enviando ? 0.7 : 1,
          }}
        >
          {enviando ? "Creando…" : "Crear parqueadero"}
        </button>
      </form>
    </>
  );
}

function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  requerido = false,
  autoFocus = false,
}: {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  requerido?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
        {etiqueta}
        {!requerido && (
          <span style={{ color: "var(--texto-tenue)", fontWeight: 400 }}> (opcional)</span>
        )}
      </span>
      <input
        name={nombre}
        type={tipo}
        required={requerido}
        autoFocus={autoFocus}
        style={{
          padding: "0.625rem 0.75rem",
          fontSize: "1rem",
          borderRadius: "9px",
                  background: "var(--fondo)",
          color: "var(--texto)",
        }}
      />
    </label>
  );
}
