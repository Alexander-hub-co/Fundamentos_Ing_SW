"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  accionBuscarPorCedula,
  accionCerrarSinFicha,
  accionComprobanteEmitido,
  accionRecibirBicicleta,
  accionTelefonoConocido,
  type EstadoBicicleta,
  type EstadoBusqueda,
  type EstadoTaquilla,
} from "./acciones";
import { imprimirDocumento } from "./imprimir";
import {
  botonMenudo,
  botonPrimario,
  botonSecundario,
  campoTexto,
  cifra,
  deshabilitado,
  rotuloSeccion,
} from "@/app/ui";

/**
 * La vía de las bicicletas.
 *
 * Aparece plegada. La taquilla es la pantalla que se mira todo el día y la
 * constitución obliga a justificar cada añadido: un parqueadero que sólo recibe
 * carros no debería ver un formulario que no va a usar nunca.
 */
export function Bicicletas({
  disponibles,
  reloj,
}: {
  disponibles: number;
  /** La hora llega del servidor: React 19 rechaza `Date.now()` al pintar. */
  reloj: number;
}) {
  const [abierto, setAbierto] = useState<"ninguno" | "recibir" | "buscar">("ninguno");

  return (
    <section style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <h2 className="rotulo-filete" style={{ ...rotuloSeccion, margin: 0 }}>Bicicletas</h2>
        <span style={{ fontSize: "13px", color: "var(--texto-tenue)" }}>
          <strong style={{ ...cifra, color: disponibles === 0 ? "var(--aviso-tinta)" : "var(--acento)" }}>
            {disponibles}
          </strong>{" "}
          {disponibles === 1 ? "espacio libre" : "espacios libres"}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAbierto(abierto === "recibir" ? "ninguno" : "recibir")}
            style={abierto === "recibir" ? botonSecundario : botonMenudo}
          >
            Recibir bicicleta
          </button>
          <button
            type="button"
            onClick={() => setAbierto(abierto === "buscar" ? "ninguno" : "buscar")}
            style={abierto === "buscar" ? botonSecundario : botonMenudo}
          >
            Perdió el ticket
          </button>
        </div>
      </div>

      {/* Para devolver NO hace falta abrir nada: el número de ficha se escribe
          en el campo de arriba, que es la ruta que ocurre con fila. */}
      <p style={{ margin: "7px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
        Para entregar una bicicleta, escriba el número de la ficha del ticket en el campo de
        arriba: el sistema da el total, igual que con un carro.
      </p>

      {abierto === "recibir" && <Recibir disponibles={disponibles} />}
      {abierto === "buscar" && <Buscar reloj={reloj} />}
    </section>
  );
}

function Recibir({ disponibles }: { disponibles: number }) {
  const [estado, recibir, recibiendo] = useActionState(
    accionRecibirBicicleta,
    {} as EstadoBicicleta,
  );
  const [conocido, consultarCedula] = useActionState(accionTelefonoConocido, {} as EstadoBicicleta);
  const [telefono, setTelefono] = useState("");
  const yaMandado = useRef<string | null>(null);

  // El teléfono que esa cédula dio antes. Es lo que hace que un cliente
  // habitual cueste UN dato en vez de dos.
  useEffect(() => {
    if (conocido.telefonoConocido) setTelefono(conocido.telefonoConocido);
  }, [conocido.telefonoConocido]);

  useEffect(() => {
    const papel = estado.comprobante;
    if (!papel || !papel.automatico) return;
    if (yaMandado.current === papel.movimientoId) return;

    yaMandado.current = papel.movimientoId;
    void (async () => {
      const r = await imprimirDocumento(papel.html);
      if (r.ok) await accionComprobanteEmitido(papel.movimientoId);
    })();
  }, [estado.comprobante]);

  if (disponibles === 0) {
    return (
      <p role="alert" style={aviso("error")}>
        No hay espacio para más bicicletas. Hay que esperar a que salga una, o ampliar los cupos
        en Horario y capacidad.
      </p>
    );
  }

  return (
    <div style={tarjeta}>
      <form action={recibir} style={{ display: "grid", gap: "10px" }}>
        <label style={{ display: "grid", gap: "5px" }}>
          <span style={etiqueta}>Nombre</span>
          <input name="nombre" required autoComplete="off" style={{ ...campoTexto, width: "100%" }} />
        </label>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <label style={campo}>
            <span style={etiqueta}>Cédula</span>
            <input
              name="cedula"
              required
              inputMode="numeric"
              autoComplete="off"
              // Al salir del campo se consulta si esa cédula ya vino, para
              // proponer el teléfono en vez de volver a preguntarlo.
              onBlur={(e) => {
                const datos = new FormData();
                datos.set("cedula", e.currentTarget.value);
                consultarCedula(datos);
              }}
              style={{ ...campoTexto, ...cifra, width: "100%" }}
            />
          </label>

          <label style={campo}>
            <span style={etiqueta}>Teléfono</span>
            <input
              name="telefono"
              required
              inputMode="tel"
              autoComplete="off"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              style={{ ...campoTexto, ...cifra, width: "100%" }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: "5px" }}>
          <span style={etiqueta}>Seña de la bicicleta (opcional)</span>
          <input
            name="nota"
            placeholder="Negra, marca Trek"
            style={{ ...campoTexto, width: "100%" }}
          />
        </label>

        {/* Lo que la ley pide decir, en una frase que el operario pueda leerle
            al cliente. */}
        <p style={{ margin: 0, fontSize: "12px", color: "var(--texto-tenue)", lineHeight: 1.5 }}>
          El nombre, la cédula y el teléfono se piden únicamente para poder devolverle la
          bicicleta si pierde el ticket, y se borran cuando vence el plazo de conservación.
        </p>

        <button
          type="submit"
          disabled={recibiendo}
          style={deshabilitado({ ...botonPrimario, padding: "12px" }, recibiendo)}
        >
          {recibiendo ? "Recibiendo…" : "Recibir bicicleta"}
        </button>
      </form>

      {estado.error && (
        <p role="alert" style={aviso("error")}>
          {estado.error}
        </p>
      )}
      {estado.ok && !estado.error && (
        <div style={aviso("ok")}>
          <p role="status" style={{ margin: 0, fontWeight: 700 }}>
            {estado.ok}
          </p>
          {estado.comprobante && (
            <button
              type="button"
              onClick={() => void imprimirDocumento(estado.comprobante!.html)}
              style={{ ...botonSecundario, marginTop: "8px" }}
            >
              Imprimir ticket
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Buscar({ reloj }: { reloj: number }) {
  const [busqueda, buscar, buscando] = useActionState(accionBuscarPorCedula, {} as EstadoBusqueda);
  const [cierre, cerrar, cerrando] = useActionState(accionCerrarSinFicha, {} as EstadoTaquilla);

  return (
    <div style={tarjeta}>
      <form action={buscar} style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
        <input
          name="cedula"
          required
          inputMode="numeric"
          placeholder="Cédula de quien dejó la bicicleta"
          style={{ ...campoTexto, ...cifra, flex: 1, minWidth: "12rem" }}
        />
        <button type="submit" disabled={buscando} style={deshabilitado(botonSecundario, buscando)}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {busqueda.encontradas?.length === 0 && (
        <p role="status" style={aviso("error")}>
          No hay ninguna bicicleta adentro con esa cédula.
        </p>
      )}

      {busqueda.encontradas?.map((e) => (
        <div key={e.movimientoId} style={{ ...fila, marginTop: "10px" }}>
          <span style={{ ...cifra, fontWeight: 700 }}>Ficha {e.fichaNumero}</span>
          <span style={{ fontSize: "13px" }}>{e.nombre}</span>
          <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>
            desde hace {duracion(reloj - new Date(e.entradaEn).getTime())}
            {e.notaVehiculo ? ` · ${e.notaVehiculo}` : ""}
          </span>
          <form action={cerrar} style={{ marginLeft: "auto" }}>
            <input type="hidden" name="movimientoId" value={e.movimientoId} />
            <button type="submit" disabled={cerrando} style={deshabilitado(botonMenudo, cerrando)}>
              {cerrando ? "Cobrando…" : "Entregar y cobrar"}
            </button>
          </form>
        </div>
      ))}

      {(busqueda.error || cierre.error) && (
        <p role="alert" style={aviso("error")}>
          {busqueda.error ?? cierre.error}
        </p>
      )}
      {cierre.ok && (
        <p role="status" style={aviso("ok")}>
          {cierre.ok}
        </p>
      )}
    </div>
  );
}

/** "5h03", igual que en el resto de la taquilla. */
function duracion(ms: number): string {
  const minutos = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

const tarjeta: CSSProperties = {
  marginTop: "10px",
  borderRadius: "12px",
  padding: "14px 16px",
};

const fila: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "9px 12px",
  borderRadius: "10px",
  background: "var(--fondo)",
};

const campo: CSSProperties = { display: "grid", gap: "5px", flex: "1 1 10rem", minWidth: 0 };

const etiqueta: CSSProperties = { fontSize: "13px", fontWeight: 600 };

function aviso(tipo: "error" | "ok"): CSSProperties {
  return {
    margin: "10px 0 0",
    padding: "9px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    background: tipo === "error" ? "var(--error-fondo)" : "var(--fondo)",
    color: tipo === "error" ? "var(--error-texto)" : "var(--texto)",
    border: `1px solid ${tipo === "error" ? "var(--error-borde)" : "var(--borde)"}`,
  };
}
