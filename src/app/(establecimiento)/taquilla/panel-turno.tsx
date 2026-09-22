"use client";

import { useActionState } from "react";
import { accionAbrirTurno, accionCerrarTurno, type EstadoTurno } from "./acciones";
import { botonMenudo, campoTexto, cifra, deshabilitado } from "@/app/ui";

/**
 * El turno de quien está atendiendo.
 *
 * Va arriba y compacto, en una sola franja: es información de contexto, no la
 * tarea. Lo que se mira con fila es la placa, y este panel no puede competir
 * con ella.
 *
 * Sigue el lenguaje visual del panel de turno de la maqueta de reportes: borde
 * verde y punto cuando está abierto, con la hora real, la programada y cuánto
 * lleva. Que las dos horas se vean juntas es todo el punto: casi nunca
 * coinciden, y esa diferencia es lo que hay que poder revisar.
 */
export function PanelTurno({
  sesion,
  turnos,
  ahora,
}: {
  sesion: {
    id: string;
    turnoNombre: string;
    abiertaEn: Date;
    programadaInicio: string;
    programadaFin: string;
  } | null;
  /** Los turnos declarados que se pueden abrir hoy. */
  turnos: { id: string; nombre: string; horaInicio: string; horaFin: string }[];
  /**
   * El instante, calculado en el servidor y pasado como dato.
   *
   * No se lee el reloj durante el render: React lo prohíbe con razón, porque
   * un componente que consulta la hora da un resultado distinto cada vez que se
   * dibuja y deja de poder compararse consigo mismo.
   */
  ahora: Date;
}) {
  const [abierto, abrir, abriendo] = useActionState(accionAbrirTurno, {} as EstadoTurno);
  const [cerrado, cerrar, cerrando] = useActionState(accionCerrarTurno, {} as EstadoTurno);
  const falla = abierto.error ?? cerrado.error;

  if (sesion) {
    const minutos = Math.max(
      0,
      Math.floor((ahora.getTime() - new Date(sesion.abiertaEn).getTime()) / 60_000),
    );

    return (
      <>
        <div style={{ ...franja, borderColor: "var(--marca)" }}>
          <span style={punto} />
          <span style={{ ...rotulo, color: "var(--acento)" }}>
            Turno abierto · {sesion.turnoNombre}
          </span>
          <span style={{ ...cifra, fontSize: "12px", color: "var(--texto-tenue)" }}>
            abrió {hora(sesion.abiertaEn)} · programado {corta(sesion.programadaInicio)} ·
            llevan {duracion(minutos)}
          </span>

          <form action={cerrar} style={{ marginLeft: "auto" }}>
            <input type="hidden" name="sesionId" value={sesion.id} />
            <button type="submit" disabled={cerrando} style={deshabilitado(botonMenudo, cerrando)}>
              {cerrando ? "Cerrando…" : "Cerrar turno"}
            </button>
          </form>
        </div>
        {falla && <p role="alert" style={error}>{falla}</p>}
      </>
    );
  }

  return (
    <>
      <div style={franja}>
        <span style={{ ...punto, background: "var(--texto-tenue)" }} />
        <span style={rotulo}>Sin turno abierto</span>

        {turnos.length === 0 ? (
          <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>
            No hay turnos declarados. Se puede atender igual; los movimientos quedan sin turno.
          </span>
        ) : (
          <form action={abrir} style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              name="turnoId"
              required
              aria-label="Turno a abrir"
              style={{ ...campoTexto, padding: "5px 10px", fontSize: "13px" }}
            >
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} · {corta(t.horaInicio)}–{corta(t.horaFin)}
                </option>
              ))}
            </select>
            <button type="submit" disabled={abriendo} style={deshabilitado(botonMenudo, abriendo)}>
              {abriendo ? "Abriendo…" : "Abrir turno"}
            </button>
          </form>
        )}
      </div>
      {falla && <p role="alert" style={error}>{falla}</p>}
    </>
  );
}

const hora = (d: Date) =>
  new Date(d).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

/** `07:00:00` de PostgreSQL se muestra como `07:00`. */
const corta = (t: string) => t.slice(0, 5);

function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

const franja: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "16px",
  padding: "10px 14px",
  borderRadius: "12px",
};

const punto: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "var(--marca)",
  flex: "none",
};

const rotulo: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
};

const error: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "13px",
  color: "var(--error-texto)",
};
