"use client";

import { useActionState, useState } from "react";
import { guardarHorario, type EstadoHorario } from "./acciones";
import { botonPrimario, deshabilitado } from "@/app/ui";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type FranjaVisible = { diaSemana: number; horaApertura: string; horaCierre: string };

/**
 * Formulario de horario.
 *
 * Un día sin marcar es un día cerrado: la ausencia de franja ya lo dice, así
 * que no hay una casilla aparte de "cerrado" que pudiera contradecirla.
 */
export function FormularioHorario({
  abierto24h: inicial24h,
  cobraHorasCerradas: inicialCobra,
  franjas,
}: {
  abierto24h: boolean;
  cobraHorasCerradas: boolean;
  franjas: FranjaVisible[];
}) {
  const [estado, accion, enviando] = useActionState(guardarHorario, {} as EstadoHorario);
  const [h24, setH24] = useState(inicial24h);

  const porDia = (d: number) => franjas.find((f) => f.diaSemana === d);

  return (
    <form action={accion}>
      <h2 className="rotulo-filete" style={rotuloHorario}>
        Horario de atención
      </h2>
      {estado.error && <p role="alert" style={aviso("error")}>{estado.error}</p>}
      {estado.ok && !estado.error && <p role="status" style={aviso("ok")}>{estado.ok}</p>}

      {/* Las tres partes del formulario van separadas por líneas y no por
          espacio: "abre las 24 horas" anula la tabla de días, y la regla de
          cobro es independiente de las dos. La línea dice dónde termina cada
          decisión. */}
      <label style={{ ...filaControl, paddingBottom: "20px", borderBottom: "1px solid var(--borde)" }}>
        <input
          type="checkbox"
          name="abierto24h"
          value="si"
          checked={h24}
          onChange={(e) => setH24(e.target.checked)}
          style={casilla}
        />
        <span style={{ fontSize: "15px", fontWeight: 600 }}>Abierto las 24 horas</span>
      </label>

      {!h24 && (
        <div style={{ display: "grid", gap: "16px", padding: "22px 0" }}>
          {DIAS.map((nombre, d) => {
            const f = porDia(d);
            return (
              // En el teléfono esta fila se reordena: el día arriba y las dos
              // horas debajo, una al lado de la otra. Dejándola envolver sola,
              // cada hora caía en su propio renglón y los siete días ocupaban
              // pantalla y media.
              <div key={d} className="fila-horario">
                <label style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                  <input type="checkbox" name={`abre-${d}`} value="si" defaultChecked={!!f} style={casilla} />
                  <span style={{ minWidth: "104px", fontSize: "14px" }}>{nombre}</span>
                </label>
                <input
                  type="time"
                  name={`apertura-${d}`}
                  aria-label={`Hora de apertura, ${nombre}`}
                  defaultValue={f?.horaApertura.slice(0, 5) ?? "07:00"}
                  style={campoHora}
                />
                <span style={{ color: "var(--texto-tenue)", fontSize: "13px" }}>a</span>
                <input
                  type="time"
                  name={`cierre-${d}`}
                  aria-label={`Hora de cierre, ${nombre}`}
                  defaultValue={f?.horaCierre.slice(0, 5) ?? "20:00"}
                  style={campoHora}
                />
              </div>
            );
          })}
        </div>
      )}

      <label
        style={{
          display: "flex",
          gap: "11px",
          alignItems: "flex-start",
          padding: "22px 0",
          borderTop: "1px solid var(--borde)",
        }}
      >
        <input
          type="checkbox"
          name="cobraHorasCerradas"
          value="si"
          defaultChecked={inicialCobra}
          style={{ ...casilla, marginTop: "1px" }}
        />
        <span>
          <strong style={{ fontSize: "14px", fontWeight: 600 }}>Cobrar las horas cerradas</strong>
          <span style={{ display: "block", fontSize: "12px", color: "var(--texto-tenue)", marginTop: "2px", lineHeight: 1.5 }}>
            A los vehículos que se quedan adentro mientras el parqueadero está cerrado. La regla
            vale para todos los tipos por igual.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={enviando}
        style={{ ...deshabilitado(botonPrimario, enviando), padding: "14px", fontSize: "15px", width: "100%", marginTop: "6px" }}
      >
        {enviando ? "Guardando…" : "Guardar horario"}
      </button>
    </form>
  );
}

/** El rótulo que le faltaba: sin caja, el formulario no decía qué era. */
const rotuloHorario: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
  margin: "0 0 18px",
};

const filaControl: React.CSSProperties = { display: "flex", alignItems: "center", gap: "10px" };

/**
 * Casilla nativa, no un cuadrado dibujado con spans.
 *
 * La maqueta muestra un recuadro verde con un visto; se consigue con
 * `accentColor` sobre el control real. Reemplazarlo por un div estilizado
 * costaría el foco de teclado, el estado que anuncia el lector de pantalla y
 * el envío del formulario, a cambio de nada visible.
 */
const casilla: React.CSSProperties = {
  width: "17px",
  height: "17px",
  flex: "none",
  accentColor: "var(--marca)",
};

const campoHora: React.CSSProperties = {
  padding: "6px 11px",
  border: "1px solid var(--borde-control)",
  borderRadius: "8px",
  background: "var(--fondo)",
  color: "var(--texto)",
  fontFamily: "var(--fuente-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  fontSize: "14px",
};

function aviso(tipo: "error" | "ok"): React.CSSProperties {
  return {
    margin: 0,
    fontSize: "0.875rem",
    borderRadius: "9px",
    padding: "0.625rem 0.75rem",
    color: tipo === "error" ? "var(--error-texto)" : "var(--marca-texto)",
    background: tipo === "error" ? "var(--error-fondo)" : "transparent",
    border: `1px solid ${tipo === "error" ? "var(--error-borde)" : "var(--borde-control)"}`,
  };
}
