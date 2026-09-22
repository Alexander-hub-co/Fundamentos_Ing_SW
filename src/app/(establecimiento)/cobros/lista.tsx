"use client";

import { useActionState, useState } from "react";
import type { CSSProperties } from "react";
import { accionCorregir, type EstadoCorreccion } from "../taquilla/acciones";
import { botonMenudo, campoTexto, cifra, deshabilitado } from "@/app/ui";
import type { CobroDelPeriodo } from "@/dominio/reportes/cobros";

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * La lista de cobros, con la corrección.
 *
 * Corregir un cobro vivía junto al campo de placa y se muda acá con la lista.
 * Es lo correcto: un cobro mal hecho se nota minutos después, pero corregirlo
 * exige escribir dos datos y pensar, y eso no se hace con un carro esperando.
 *
 * Esconder el botón NO es control de acceso: el dominio vuelve a exigir el
 * permiso. Esto sólo evita ofrecer algo que fallaría.
 */
export function ListaDeCobros({
  cobros,
  puedeCorregir,
}: {
  cobros: CobroDelPeriodo[];
  puedeCorregir: boolean;
}) {
  const [estado, corregir, corrigiendo] = useActionState(accionCorregir, {} as EstadoCorreccion);
  const [abierto, setAbierto] = useState<string | null>(null);

  if (cobros.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--texto-tenue)", fontSize: "14px" }}>
        No hay cobros en este período.
      </p>
    );
  }

  return (
    <>
      {estado.error && (
        <p role="alert" style={aviso("error")}>
          {estado.error}
        </p>
      )}
      {estado.ok && !estado.error && (
        <p role="status" style={aviso("ok")}>
          {estado.ok}
        </p>
      )}

      <div className="filas filas-vivas">
        {cobros.map((c) => (
          <div
            key={c.id}
            // Ni relleno lateral ni filete propio: los pone la lista, que es
            // la que sabe cuál es la primera fila.
            style={{ padding: 0 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ ...cifra, fontWeight: 700, fontSize: "14px", minWidth: "7rem" }}>
                {c.rotulo}
              </span>
              <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>
                {fecha(c.salidaEn)} · {c.tipoNombre}
              </span>

              <span style={{ marginLeft: "auto", ...cifra, fontWeight: 700 }}>
                {c.cortesiaMotivo !== null ? (
                  <span style={{ color: "var(--texto-tenue)", fontWeight: 500 }}>Sin cobro</span>
                ) : c.corregidoA !== null ? (
                  <>
                    <span style={tachado}>{pesos(c.importe)}</span>
                    {pesos(c.corregidoA)}
                  </>
                ) : (
                  pesos(c.importe)
                )}
              </span>
            </div>

            {c.cortesiaMotivo !== null && <p style={nota}>{c.cortesiaMotivo}</p>}
            {c.corregidoA !== null && <p style={nota}>Corregido · el original se conserva</p>}

            {puedeCorregir &&
              c.cortesiaMotivo === null &&
              (abierto === c.id ? (
                <form
                  action={corregir}
                  style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}
                >
                  <input type="hidden" name="movimientoId" value={c.id} />
                  <input
                    name="importe"
                    type="number"
                    min={0}
                    required
                    placeholder="Importe correcto"
                    aria-label="Importe correcto"
                    style={{ ...campoTexto, ...cifra, width: "8rem", fontSize: "13px", padding: "5px 8px" }}
                  />
                  <input
                    name="motivo"
                    required
                    placeholder="Qué se corrige"
                    aria-label="Motivo de la corrección"
                    style={{ ...campoTexto, flex: 1, minWidth: "9rem", fontSize: "13px", padding: "5px 8px" }}
                  />
                  <button
                    type="submit"
                    disabled={corrigiendo}
                    style={deshabilitado(botonMenudo, corrigiendo)}
                  >
                    Corregir
                  </button>
                  <button type="button" onClick={() => setAbierto(null)} style={botonMenudo}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAbierto(c.id)}
                  style={{ ...botonMenudo, marginTop: "8px" }}
                >
                  Corregir este cobro
                </button>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}

function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(d);
}

const nota: CSSProperties = {
  margin: "4px 0 0",
  fontSize: "12px",
  color: "var(--texto-tenue)",
};

const tachado: CSSProperties = {
  color: "var(--texto-tenue)",
  fontWeight: 500,
  textDecoration: "line-through",
  marginRight: "7px",
};

function aviso(tipo: "error" | "ok"): CSSProperties {
  return {
    margin: "0 0 10px",
    padding: "9px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    background: tipo === "error" ? "var(--error-fondo)" : "var(--superficie)",
    color: tipo === "error" ? "var(--error-texto)" : "var(--texto)",
    border: `1px solid ${tipo === "error" ? "var(--error-borde)" : "var(--borde)"}`,
  };
}
