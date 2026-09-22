"use client";

import { useActionState } from "react";
import { probarCalculo, type EstadoProbador } from "./acciones";
import { botonSecundario, campoTexto, cifra, deshabilitado, importe, tarjeta } from "@/app/ui";
import type { TipoVehiculo } from "@/db/esquema";

const INICIAL: EstadoProbador = {};

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;
const cuando = (d: Date) =>
  new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

/**
 * Probador del cálculo.
 *
 * Deja comprobar la tarifa con dos instantes de ejemplo antes de que llegue el
 * primer cliente. Muestra el desglose y no sólo el total: es lo que permite
 * entender de dónde sale la cifra y detectar una tarifa mal declarada mirando
 * los tramos, no adivinando.
 */
export function Probador({ tipos }: { tipos: TipoVehiculo[] }) {
  const [estado, accion, enviando] = useActionState(probarCalculo, INICIAL);
  const cobro = estado.cobro;

  return (
    <form action={accion} style={{ ...tarjeta, display: "grid", gap: "14px", padding: "22px" }}>
      <select name="tipoVehiculoId" style={campoTexto} defaultValue={tipos[0]?.id ?? ""}>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>

      <label style={{ display: "grid", gap: "0.375rem" }}>
        <span style={etiqueta}>Entrada</span>
        <input name="entrada" type="datetime-local" required style={campoTexto} />
      </label>

      <label style={{ display: "grid", gap: "0.375rem" }}>
        <span style={etiqueta}>Salida</span>
        <input name="salida" type="datetime-local" required style={campoTexto} />
      </label>

      <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
        {enviando ? "Calculando…" : "Calcular"}
      </button>

      {estado.error && (
        <p role="alert" style={{ margin: 0, fontSize: "0.875rem", color: "var(--error-texto)" }}>
          {estado.error}
        </p>
      )}

      {cobro && (
        <div role="status" style={{ borderTop: "1px solid var(--borde)", paddingTop: "16px" }}>
          {/* El total manda en el panel. Es lo que se viene a comprobar, y a
              este tamaño se lee sin buscarlo entre los tramos. */}
          <p style={{ ...importe, fontSize: "30px", lineHeight: 1.1, margin: 0, color: "var(--acento)" }}>
            {pesos(cobro.importe)}
          </p>
          <p style={{ margin: "2px 0 14px", fontSize: "13px", color: "var(--texto-tenue)" }}>
            {cobro.minutosTotales} minutos cobrables
            {cobro.tope === "plena" && " · se aplicó la tarifa plena"}
            {cobro.tope === "minima" && " · se aplicó la tarifa mínima"}
          </p>

          {cobro.tramos.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: "var(--texto-tenue)" }}>
              No hay nada que cobrar: toda la permanencia cae en horas con el establecimiento
              cerrado, y este local no las cobra.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {cobro.tramos.map((t, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    padding: "7px 0",
                    borderBottom:
                      i === cobro.tramos.length - 1 ? undefined : "1px solid var(--borde)",
                    fontSize: "13px",
                  }}
                >
                  <span>
                    {cuando(t.desde)} → {cuando(t.hasta)}
                  </span>
                  <span style={{ color: "var(--texto-tenue)" }}>
                    {t.minutos} min
                    {t.intervalos !== undefined && ` · ${t.intervalos} intervalos`}
                    {t.tope === "plena" && " · plena"}
                    {t.tope === "minima" && " · mínima"}
                  </span>
                  <strong style={{ ...cifra, marginLeft: "auto" }}>{pesos(t.importe)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

const etiqueta: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 500 };

/* El desglose no es adorno: una tarifa mal declarada se detecta mirando los
   tramos, no el total, porque el total siempre parece plausible. */
