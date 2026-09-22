"use client";

import { useActionState } from "react";
import { botonPrimario, botonTenue, campoTexto, deshabilitado } from "@/app/ui";

export type EstadoEdicion = { error?: string };

export type ValoresEstablecimiento = {
  codigo: string;
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
};

/**
 * Formulario de datos del establecimiento.
 *
 * Lo comparten las dos ediciones que pide la especificación —la del
 * administrador general sobre cualquier establecimiento (FR-018) y la del
 * administrador sobre el suyo (FR-022)— porque los campos son los mismos y dos
 * copias acabarían divergiendo. Lo que cambia entre una y otra es la acción de
 * servidor, y esa llega por propiedad.
 *
 * El código NO es editable y se muestra igual, en vez de esconderlo: es
 * inmutable de por vida (FR-017) y verlo deshabilitado explica por qué no se
 * puede tocar mejor que su ausencia.
 */
export function CamposEstablecimiento({
  accion,
  valores,
  volverA,
  campoOculto,
}: {
  accion: (previo: EstadoEdicion, datos: FormData) => Promise<EstadoEdicion>;
  valores: ValoresEstablecimiento;
  volverA: string;
  /**
   * Dato que la acción necesita y no puede deducir. La edición del propio
   * establecimiento no lo usa —su ámbito sale de la sesión—, pero la del
   * administrador general sí: la acción de servidor no recibe los parámetros
   * de la ruta, así que el identificador tiene que viajar en el formulario.
   */
  campoOculto?: { nombre: string; valor: string };
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});

  return (
    <form
      action={enviar}
      style={{ display: "grid", gap: "1rem", maxWidth: "26rem", marginTop: "1.5rem" }}
    >
      {campoOculto && (
        <input type="hidden" name={campoOculto.nombre} value={campoOculto.valor} />
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

      <label style={{ display: "grid", gap: "0.375rem" }}>
        <span style={etiqueta}>Código</span>
        <input
          value={valores.codigo}
          disabled
          readOnly
          style={{ ...campoTexto, opacity: 0.7, cursor: "not-allowed" }}
        />
        <span style={ayuda}>
          Se asigna al dar de alta el establecimiento y no cambia nunca. Es la sigla que
          llevan los códigos de su gente.
        </span>
      </label>

      <Campo nombre="nombre" etiqueta="Nombre" valor={valores.nombre} requerido autoFocus />
      <Campo nombre="ciudad" etiqueta="Ciudad" valor={valores.ciudad} />
      <Campo nombre="direccion" etiqueta="Dirección" valor={valores.direccion} />
      <Campo nombre="telefono" etiqueta="Teléfono" valor={valores.telefono} tipo="tel" />

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="submit" disabled={enviando} style={deshabilitado(botonPrimario, enviando)}>
          {enviando ? "Guardando…" : "Guardar cambios"}
        </button>
        <a href={volverA} style={botonTenue}>
          Cancelar
        </a>
      </div>
    </form>
  );
}

function Campo({
  nombre,
  etiqueta: texto,
  valor,
  tipo = "text",
  requerido = false,
  autoFocus = false,
}: {
  nombre: string;
  etiqueta: string;
  valor: string | null;
  tipo?: string;
  requerido?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={etiqueta}>{texto}</span>
      <input
        name={nombre}
        type={tipo}
        required={requerido}
        autoFocus={autoFocus}
        defaultValue={valor ?? ""}
        style={campoTexto}
      />
    </label>
  );
}

const etiqueta: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 500 };
const ayuda: React.CSSProperties = { fontSize: "0.8125rem", color: "var(--texto-tenue)" };
