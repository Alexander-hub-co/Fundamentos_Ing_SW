"use client";

import { useActionState, useState } from "react";
import { accionSobreCuenta, type EstadoCuentas } from "../acciones";
import { botonPeligro, botonSecundario, campoTexto, deshabilitado } from "@/app/ui";

const INICIAL: EstadoCuentas = {};

/**
 * Acciones sobre una cuenta, desde su ficha.
 *
 * Antes vivían repetidas en cada renglón del listado. Acá tienen sitio para
 * explicarse: quien va a anonimizar una cuenta debería leer qué significa eso
 * antes de hacerlo, y en un renglón estrecho no cabía la advertencia.
 *
 * La autorización no depende de esta pantalla. Cada acción vuelve a exigirla en
 * el servidor (FR-003); esconder un botón sólo evita ofrecer algo que fallaría.
 */
export function AccionesCuenta({
  id,
  bloqueada,
  esAdminGeneral,
  tieneEstablecimiento,
  establecimientos,
}: {
  id: string;
  bloqueada: boolean;
  esAdminGeneral: boolean;
  tieneEstablecimiento: boolean;
  establecimientos: { id: string; nombre: string; codigo: string }[];
}) {
  const [estado, accion, enviando] = useActionState(accionSobreCuenta, INICIAL);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
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

      <Bloque
        titulo={bloqueada ? "Desbloquear" : "Bloquear"}
        explicacion={
          bloqueada
            ? "La persona vuelve a poder entrar con su contraseña de siempre."
            : "Le impide entrar, pero conserva la cuenta y todo su historial. Es reversible."
        }
      >
        <form action={accion}>
          <input type="hidden" name="accion" value={bloqueada ? "desbloquear" : "bloquear"} />
          <input type="hidden" name="usuarioId" value={id} />
          <input type="hidden" name="confirmado" value="si" />
          <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
            {bloqueada ? "Desbloquear la cuenta" : "Bloquear la cuenta"}
          </button>
        </form>
      </Bloque>

      {/* FR-019. Un administrador general no se vincula a ningún local, así
          que para esas cuentas la sección no aplica y no se muestra. */}
      {!esAdminGeneral &&
        (tieneEstablecimiento ? (
          <Bloque
            titulo="Retirar del establecimiento"
            explicacion="La cuenta deja de pertenecer a este local y no podrá entrar hasta que se le asigne otro. El historial de lo que hizo se conserva."
          >
            <ConConfirmacion
              accion={accion}
              id={id}
              tipo="retirar"
              texto="Retirar del establecimiento"
              pregunta="¿Confirma retirar esta cuenta de su establecimiento?"
              enviando={enviando}
            />
          </Bloque>
        ) : (
          <Bloque
            titulo="Asignar a un establecimiento"
            explicacion="Sin establecimiento la cuenta no puede trabajar en ninguno. Una cuenta pertenece a uno solo."
          >
            <form action={accion} style={{ display: "grid", gap: "0.5rem", maxWidth: "22rem" }}>
              <input type="hidden" name="accion" value="asignar" />
              <input type="hidden" name="usuarioId" value={id} />
              <select name="parqueaderoId" required style={campoTexto}>
                <option value="">Seleccione un establecimiento…</option>
                {establecimientos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nombre}
                  </option>
                ))}
              </select>
              <select name="rol" defaultValue="operario" style={campoTexto}>
                <option value="operario">Operario de taquilla</option>
                <option value="admin_parqueadero">Administrador del parqueadero</option>
              </select>
              <button
                type="submit"
                disabled={enviando}
                style={deshabilitado(botonSecundario, enviando)}
              >
                {enviando ? "Asignando…" : "Asignar"}
              </button>
            </form>
          </Bloque>
        ))}

      <Bloque
        titulo="Restablecer la contraseña"
        explicacion="Escriba una contraseña temporal y entréguesela por fuera del sistema. Al entrar, se le exigirá cambiarla."
      >
        <Restablecer accion={accion} id={id} enviando={enviando} />
      </Bloque>

      <Bloque
        titulo="Dar de baja"
        explicacion="Cierra la cuenta y la deja fuera de servicio. El historial de lo que hizo se conserva íntegro."
      >
        <ConConfirmacion
          accion={accion}
          id={id}
          tipo="dar_de_baja"
          texto="Dar de baja"
          pregunta="¿Confirma dar de baja esta cuenta?"
          enviando={enviando}
        />
      </Bloque>

      <Bloque
        titulo="Anonimizar"
        explicacion="Borra el nombre y el correo de manera definitiva. El historial de movimientos sobrevive, pero deja de estar asociado a una persona identificable. No se puede deshacer."
      >
        <ConConfirmacion
          accion={accion}
          id={id}
          tipo="anonimizar"
          texto="Anonimizar"
          pregunta="Esto borra el nombre y el correo para siempre y no se puede deshacer. ¿Continúa?"
          enviando={enviando}
          peligro
        />
      </Bloque>
    </div>
  );
}

function Bloque({
  titulo,
  explicacion,
  children,
}: {
  titulo: string;
  explicacion: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 style={{ fontSize: "0.9375rem", margin: "0 0 0.125rem" }}>{titulo}</h3>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "var(--texto-tenue)" }}>
        {explicacion}
      </p>
      {children}
    </div>
  );
}

function Restablecer({
  accion,
  id,
  enviando,
}: {
  accion: (f: FormData) => void;
  id: string;
  enviando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} style={botonSecundario}>
        Restablecer la contraseña
      </button>
    );
  }

  return (
    <form action={accion} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <input type="hidden" name="accion" value="restablecer" />
      <input type="hidden" name="usuarioId" value={id} />
      <input
        name="passwordTemporal"
        placeholder="Contraseña temporal"
        required
        autoComplete="off"
        style={{ ...campoTexto, fontSize: "0.9375rem" }}
      />
      <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
        {enviando ? "Guardando…" : "Guardar"}
      </button>
      <button type="button" onClick={() => setAbierto(false)} style={botonSecundario}>
        Cancelar
      </button>
    </form>
  );
}

function ConConfirmacion({
  accion,
  id,
  tipo,
  texto,
  pregunta,
  enviando,
  peligro = false,
}: {
  accion: (f: FormData) => void;
  id: string;
  tipo: string;
  texto: string;
  pregunta: string;
  enviando: boolean;
  peligro?: boolean;
}) {
  const estilo = peligro ? botonPeligro : botonSecundario;
  return (
    <form action={accion}>
      <input type="hidden" name="accion" value={tipo} />
      <input type="hidden" name="usuarioId" value={id} />
      {/* La confirmación la exige el dominio; acá se declara explícita. */}
      <input type="hidden" name="confirmado" value="si" />
      <button
        type="submit"
        disabled={enviando}
        onClick={(e) => {
          if (!confirm(pregunta)) e.preventDefault();
        }}
        style={deshabilitado(estilo, enviando)}
      >
        {texto}
      </button>
    </form>
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
