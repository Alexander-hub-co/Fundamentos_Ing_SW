"use client";

import { useActionState, useState } from "react";
import { accionSobreCuenta, type EstadoCuentas } from "./acciones";
import {
  botonPrimario,
  campoTexto,
  deshabilitado,
  tarjeta,
  textoTenue,
  tituloPantalla,
} from "@/app/ui";

const INICIAL: EstadoCuentas = {};

/**
 * Alta de cuenta.
 *
 * Vive aparte del listado porque el listado ya no necesita ser interactivo: las
 * acciones sobre cada cuenta se mudaron a su ficha. Así la página de cuentas se
 * renderiza en el servidor y sólo este formulario viaja al navegador.
 */
export function NuevaCuenta({
  establecimientos,
  resumen,
}: {
  establecimientos: { id: string; nombre: string }[];
  /** Línea de contexto bajo el título: cuántas hay y cómo están ordenadas. */
  resumen: string;
}) {
  const [estado, accion, enviando] = useActionState(accionSobreCuenta, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState("operario");

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h1 style={tituloPantalla}>Cuentas</h1>
          <p style={textoTenue}>{resumen}</p>
        </div>
        <button type="button" onClick={() => setAbierto((v) => !v)} style={botonPrimario}>
          {abierto ? "Cancelar" : "Nueva cuenta"}
        </button>
      </div>

      {estado.error && (
        <p
          role="alert"
          style={{
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

      {abierto && (
        <form action={accion} style={{ ...tarjeta, marginBottom: "1.5rem" }}>
          <input type="hidden" name="accion" value="crear" />
          <div style={{ display: "grid", gap: "0.875rem" }}>
            <Campo nombre="nombre" etiqueta="Nombre" requerido />
            <Campo nombre="email" etiqueta="Correo" tipo="email" requerido />
            <Campo
              nombre="passwordTemporal"
              etiqueta="Contraseña temporal"
              requerido
              ayuda="Usted se la entrega por fuera del sistema. La persona deberá cambiarla al entrar."
            />

            <label style={{ display: "grid", gap: "0.375rem" }}>
              <span style={etiquetaCampo}>Rol</span>
              <select
                name="rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                style={campoTexto}
              >
                <option value="operario">Operario</option>
                <option value="admin_parqueadero">Administrador de parqueadero</option>
                <option value="admin_general">Administrador general</option>
              </select>
            </label>

            {rol !== "admin_general" && (
              <label style={{ display: "grid", gap: "0.375rem" }}>
                <span style={etiquetaCampo}>Establecimiento</span>
                <select name="parqueaderoId" required style={campoTexto}>
                  <option value="">Seleccione uno…</option>
                  {establecimientos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="submit"
              disabled={enviando}
              style={deshabilitado(botonPrimario, enviando)}
            >
              {enviando ? "Creando…" : "Crear cuenta"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  requerido = false,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  requerido?: boolean;
  ayuda?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={etiquetaCampo}>{etiqueta}</span>
      <input name={nombre} type={tipo} required={requerido} style={campoTexto} />
      {ayuda && (
        <span style={{ fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>{ayuda}</span>
      )}
    </label>
  );
}

const etiquetaCampo: React.CSSProperties = { fontSize: "0.875rem", fontWeight: 500 };
