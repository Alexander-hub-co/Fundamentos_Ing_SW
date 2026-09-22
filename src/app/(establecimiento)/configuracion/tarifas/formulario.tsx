"use client";

import { useActionState, useState } from "react";
import { guardarTarifa, type EstadoTarifa } from "./acciones";
import { botonPrimario, campoTexto, deshabilitado, tarjeta } from "@/app/ui";
import type { ModeloCobro, TipoVehiculo } from "@/db/esquema";

const INICIAL: EstadoTarifa = {};

/** Qué hace cada modelo, en una línea que se entienda sin saber de tarifas. */
const AYUDA: Record<ModeloCobro, string> = {
  por_minuto: "El valor crece minuto a minuto, con un piso y un techo.",
  por_intervalo: "Cualquier fracción de intervalo cobra el intervalo entero.",
  primera_hora_y_fraccion:
    "La primera hora se cobra entera; después, cada fracción cobra el bloque completo.",
};

/**
 * Formulario de tarifa.
 *
 * Los campos cambian según el modelo elegido, y los del modelo descartado no se
 * envían: la tabla tiene un CHECK que exige exactamente los del modelo
 * declarado y anula los del otro.
 *
 * Ningún importe viene precargado. El Principio II prohíbe suponer cuánto cobra
 * un parqueadero, y un valor por defecto en un campo es una suposición que la
 * gente acepta sin leer.
 */
export function FormularioTarifa({
  tipos,
  vigentePorTipo,
}: {
  tipos: TipoVehiculo[];
  vigentePorTipo: Record<string, { modelo: ModeloCobro } | undefined>;
}) {
  const [estado, accion, enviando] = useActionState(guardarTarifa, INICIAL);
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? "");

  const tipo = tipos.find((t) => t.id === tipoId);
  const [modelo, setModelo] = useState<ModeloCobro>(
    vigentePorTipo[tipos[0]?.id ?? ""]?.modelo ?? tipos[0]?.modeloSugerido ?? "por_minuto",
  );

  function cambiarTipo(id: string) {
    setTipoId(id);
    const t = tipos.find((x) => x.id === id);
    // Se propone el modelo que ya rige, y si no hay tarifa todavía, el sugerido
    // por el catálogo. Sigue siendo una propuesta: se puede cambiar.
    setModelo(vigentePorTipo[id]?.modelo ?? t?.modeloSugerido ?? "por_minuto");
  }

  return (
    <form action={accion} style={{ ...tarjeta, display: "grid", gap: "18px", padding: "22px" }}>
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

      <Campo etiqueta="Tipo de vehículo">
        <select
          name="tipoVehiculoId"
          value={tipoId}
          onChange={(e) => cambiarTipo(e.target.value)}
          style={campoTexto}
        >
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        etiqueta="Cómo se cobra"
        ayuda={AYUDA[modelo]}
      >
        <select
          name="modelo"
          value={modelo}
          onChange={(e) => setModelo(e.target.value as ModeloCobro)}
          style={campoTexto}
        >
          <option value="por_minuto">Por minuto, con mínima y plena</option>
          <option value="por_intervalo">Por intervalos, con plena por jornada</option>
          <option value="primera_hora_y_fraccion">Primera hora fija y después bloques</option>
        </select>
      </Campo>

      {modelo === "por_minuto" && (
        <>
          <Campo etiqueta="Tarifa mínima" ayuda="Lo que se paga aunque el cálculo dé menos.">
            <input name="tarifaMinima" type="number" min={0} required style={campoTexto} />
          </Campo>
          <Campo etiqueta="Valor por minuto">
            <input name="valorMinuto" type="number" min={0} required style={campoTexto} />
          </Campo>
        </>
      )}

      {modelo === "primera_hora_y_fraccion" && (
        <Campo
          etiqueta="Precio de la primera hora"
          ayuda="Se cobra entera aunque el vehículo se vaya antes."
        >
          <input name="valorPrimeraHora" type="number" min={0} required style={campoTexto} />
        </Campo>
      )}

      {modelo !== "por_minuto" && (
        <>
          <Campo
            etiqueta={
              modelo === "por_intervalo"
                ? "Duración del intervalo (minutos)"
                : "Duración del bloque (minutos)"
            }
          >
            <input name="intervaloMinutos" type="number" min={1} required style={campoTexto} />
          </Campo>
          <Campo
            etiqueta={modelo === "por_intervalo" ? "Valor del intervalo" : "Valor del bloque"}
          >
            <input name="valorIntervalo" type="number" min={0} required style={campoTexto} />
          </Campo>
        </>
      )}

      <Campo etiqueta="Tarifa plena" ayuda="El máximo que se puede cobrar.">
        <input name="tarifaPlena" type="number" min={0} required style={campoTexto} />
      </Campo>

      <Campo
        etiqueta="La plena topa…"
        ayuda="Es la diferencia entre que un vehículo guardado tres días pague una plena o tres."
      >
        <select name="alcancePlena" defaultValue="jornada" style={campoTexto}>
          <option value="jornada">Cada jornada por separado</option>
          <option value="estadia">Toda la estadía</option>
        </select>
      </Campo>

      <button type="submit" disabled={enviando} style={deshabilitado(botonPrimario, enviando)}>
        {enviando
          ? "Guardando…"
          : vigentePorTipo[tipoId]
            ? `Reemplazar la tarifa de ${tipo?.nombre ?? ""}`
            : `Declarar la tarifa de ${tipo?.nombre ?? ""}`}
      </button>

      {vigentePorTipo[tipoId] && (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>
          La tarifa actual no se borra: queda archivada con su periodo de vigencia, para que un
          vehículo que entró antes se pueda cobrar con la que regía al entrar.
        </p>
      )}
    </form>
  );
}

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{etiqueta}</span>
      {children}
      {ayuda && (
        <span style={{ fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>{ayuda}</span>
      )}
    </label>
  );
}

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
