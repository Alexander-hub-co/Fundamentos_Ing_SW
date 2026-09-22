"use client";

import { useActionState, useState } from "react";
import { cambiarEstado, type EstadoAccion } from "./acciones";

const INICIAL: EstadoAccion = {};

type Opcion = { valor: string; etiqueta: string; explicacion: string };

export function FormularioEstado({
  parqueaderoId,
  posibles,
}: {
  parqueaderoId: string;
  posibles: Opcion[];
}) {
  const [estado, accion, enviando] = useActionState(cambiarEstado, INICIAL);
  const [elegido, setElegido] = useState("");

  const esBaja = elegido === "dado_de_baja";

  return (
    <form action={accion} style={{ marginTop: "2rem", display: "grid", gap: "1rem", maxWidth: "32rem" }}>
      <input type="hidden" name="parqueaderoId" value={parqueaderoId} />

      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
        <legend style={{ fontSize: "0.875rem", fontWeight: 600, padding: 0, marginBottom: "0.25rem" }}>
          Cambiar a
        </legend>

        {posibles.map((op) => (
          <label
            key={op.valor}
            style={{
              display: "flex",
              gap: "0.625rem",
              alignItems: "flex-start",
              padding: "0.75rem",
              border: `1px solid ${elegido === op.valor ? "var(--marca-sobre)" : "var(--borde)"}`,
              borderRadius: "9px",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="nuevoEstado"
              value={op.valor}
              checked={elegido === op.valor}
              onChange={(e) => setElegido(e.target.value)}
              required
              style={{ marginTop: "0.3125rem" }}
            />
            <span>
              <span style={{ fontWeight: 600 }}>{op.etiqueta}</span>
              <span style={{ display: "block", fontSize: "0.875rem", color: "var(--texto-tenue)" }}>
                {op.explicacion}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label style={{ display: "grid", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          Motivo
          <span style={{ color: "var(--texto-tenue)", fontWeight: 400 }}>
            {" "}
            — queda registrado y es la única constancia de por qué
          </span>
        </span>
        <textarea
          name="motivo"
          required
          rows={3}
          placeholder="Ej.: no paga desde julio, ya se le avisó dos veces"
          style={{
            padding: "0.625rem 0.75rem",
            fontSize: "1rem",
            fontFamily: "inherit",
            borderRadius: "9px",
                      background: "var(--fondo)",
            color: "var(--texto)",
            resize: "vertical",
          }}
        />
      </label>

      {esBaja && (
        <label
          style={{
            display: "flex",
            gap: "0.625rem",
            alignItems: "flex-start",
            padding: "0.75rem",
            border: "1px solid #f59e0b",
            borderRadius: "9px",
            background: "#fffbeb",
          }}
        >
          <input type="checkbox" name="confirmado" value="si" required style={{ marginTop: "0.3125rem" }} />
          <span style={{ fontSize: "0.875rem" }}>
            Entiendo que dar de baja le retira <strong>todo</strong> acceso a los
            usuarios de este establecimiento. Su información se conserva y se
            puede reactivar.
          </span>
        </label>
      )}

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
        disabled={enviando || !elegido}
        style={{
          padding: "0.6875rem 1rem",
          fontSize: "1rem",
          fontWeight: 600,
          borderRadius: "9px",
          border: "none",
          cursor: enviando || !elegido ? "not-allowed" : "pointer",
          background: "var(--boton-fondo)",
          color: "var(--boton-texto)",
          opacity: enviando || !elegido ? 0.5 : 1,
        }}
      >
        {enviando ? "Aplicando…" : "Aplicar cambio"}
      </button>
    </form>
  );
}
