"use client";

import { useActionState } from "react";
import { guardarCapacidad, type EstadoHorario } from "./acciones";
import { botonMenudo, deshabilitado } from "@/app/ui";
import type { TipoVehiculo } from "@/db/esquema";

/** Cupos por tipo de vehículo. Un formulario por tipo, cada uno independiente. */
export function Capacidad({
  tipos,
  cuposPorTipo,
}: {
  tipos: TipoVehiculo[];
  cuposPorTipo: Record<string, number | undefined>;
}) {
  const [estado, accion, enviando] = useActionState(guardarCapacidad, {} as EstadoHorario);

  return (
    <div className="filas">
      {estado.error && (
        <p role="alert" style={{ margin: 0, fontSize: "0.875rem", color: "var(--error-texto)" }}>
          {estado.error}
        </p>
      )}

      {tipos.map((t) => (
        // Una fila por tipo, separada por filete. Antes eran formularios
        // sueltos apilados con la misma distancia entre todos, y no se veía
        // dónde acababa uno.
        <form
          key={t.id}
          action={accion}
          style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}
        >
          <input type="hidden" name="tipoVehiculoId" value={t.id} />
          <span style={{ minWidth: "104px", fontSize: "15px", fontWeight: 500 }}>{t.nombre}</span>
          <input
            name="cupos"
            type="number"
            min={0}
            aria-label={`Cupos de ${t.nombre}`}
            defaultValue={cuposPorTipo[t.id] ?? 0}
            style={campoCupos}
          />
          <span style={{ color: "var(--texto-tenue)", fontSize: "13px" }}>cupos</span>
          <button
            type="submit"
            disabled={enviando}
            style={{ ...deshabilitado(botonMenudo, enviando), marginLeft: "auto" }}
          >
            Guardar
          </button>
        </form>
      ))}

      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
        Cuántos caben. Contar cuántos hay adentro lo hace la taquilla.
      </p>
    </div>
  );
}

/**
 * Cifra alineada a la derecha y de ancho fijo: los cupos se leen en columna,
 * uno debajo de otro, y así se comparan sin que el ojo persiga el número.
 */
const campoCupos: React.CSSProperties = {
  padding: "7px 12px",
  border: "1px solid var(--borde-control)",
  borderRadius: "8px",
  background: "var(--fondo)",
  color: "var(--texto)",
  fontFamily: "var(--fuente-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  fontSize: "14px",
  minWidth: "74px",
  textAlign: "right",
};
