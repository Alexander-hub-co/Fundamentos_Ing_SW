"use client";

import { Fragment, useActionState, useState } from "react";
import { accionSobreTurnos, type EstadoTurnos } from "./acciones";
import {
  botonMenudo,
  botonPrimario,
  botonSecundario,
  campoTexto,
  cifra,
  deshabilitado,
  rotuloSeccion,
  tituloPantalla,
} from "@/app/ui";
import type { TurnoCompleto } from "@/dominio/turnos/consultar";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Cómo se nombra a cada persona dentro de una celda del cuadrante.
 *
 * Con el nombre completo, siete columnas de "Juan Pérez, Sandra Villa" no
 * caben en ninguna pantalla. Con el nombre de pila sí, y además es como se
 * llama la gente entre sí en una caseta.
 *
 * **Salvo que dos coincidan**, que en un equipo de seis pasa. Cuando dos
 * personas del MISMO turno comparten nombre de pila, las dos pasan a llevar
 * la inicial del apellido: "Juan P." y "Juan G.". No se toca a las demás, así
 * que la desambiguación sólo aparece donde de verdad hace falta.
 */
function nombresCortos(personas: { nombre: string }[]): string[] {
  const pilas = personas.map((p) => p.nombre.trim().split(/\s+/));
  const cuantas = new Map<string, number>();
  for (const [pila] of pilas) cuantas.set(pila!, (cuantas.get(pila!) ?? 0) + 1);

  return pilas.map(([pila, apellido]) =>
    (cuantas.get(pila!) ?? 0) > 1 && apellido ? `${pila} ${apellido[0]}.` : pila!,
  );
}

export function PanelTurnos({
  turnos,
  gente,
  sinCubrir,
  huecosDeMas,
}: {
  turnos: TurnoCompleto[];
  gente: { id: string; nombre: string; codigo: string | null }[];
  /** Huecos de atención sin nadie asignado, ya redactados en el servidor. */
  sinCubrir: string[];
  huecosDeMas: number;
}) {
  const [estado, accion, enviando] = useActionState(accionSobreTurnos, {} as EstadoTurnos);
  const [creando, setCreando] = useState(turnos.length === 0);
  // Un turno abierto a la vez. Con varios, la pantalla vuelve a ser la pila
  // de tarjetas repetidas que este cambio vino a quitar.
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <>
      <div style={cabecera}>
        <div>
          <h1 style={{ ...tituloPantalla, margin: 0 }}>Turnos</h1>
          <p style={{ margin: "10px 0 0", fontSize: "14px", color: "var(--texto-tenue)" }}>
            Aquí se declaran. Abrirlos y cerrarlos ocurre en la taquilla.
          </p>
        </div>
        {!creando && (
          <button type="button" onClick={() => setCreando(true)} style={botonPrimario}>
            Nuevo turno
          </button>
        )}
      </div>

      {estado.error && (
        <p role="alert" style={{ margin: "0 0 26px", color: "var(--error-texto)", fontSize: "14px" }}>
          {estado.error}
        </p>
      )}

      {/* ── Calendario semanal ────────────────────────────────────────── */}
      <div style={{ ...tarjeta, marginTop: "24px", padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          {/*
            El cuadrante semanal.
            ─────────────────────
            La maqueta marca cada día con un PUNTO. Un punto dice que ese día
            se trabaja y nada más: para saber quién, hay que volver a la
            columna de la izquierda y leer la lista de gente del turno.

            Poniendo el nombre en la celda, la rejilla contesta sola la
            pregunta que se le hace —"¿quién está el martes por la mañana?"—
            y deja de ser una marca de calendario para ser un cuadrante de
            turnos.

            El fondo tenue de la celda conserva lo que el punto hacía bien:
            que la FORMA de la semana se vea de un vistazo, sin leer.
          */}
          <table className="turnos-cuadrante">
            <thead>
              <tr>
                <th style={{ ...encabezadoCelda, textAlign: "left" }}>Turno</th>
                {DIAS.map((d) => (
                  <th key={d} style={encabezadoCelda}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => {
                const nombres = nombresCortos(t.personas);

                return (
                  /* Dos filas por turno: el cuadrante y, si está abierta, su
                     gestión debajo. Van en un fragmento porque una tabla no
                     admite envolver dos `<tr>` en un `<div>`, y meter la
                     gestión como una celda MÁS de la primera fila --que es lo
                     que hice al principio-- le añade una columna de más a la
                     rejilla y descuadra los días. */
                  <Fragment key={t.id}>
                  <tr data-inactivo={!t.activo || undefined}>
                    <th scope="row" className="turnos-turno">
                      <strong style={{ fontSize: "15px", fontWeight: 700 }}>{t.nombre}</strong>
                      <span style={{ ...cifra, display: "block", fontSize: "13px", color: "var(--texto-tenue)" }}>
                        {t.horaInicio.slice(0, 5)}–{t.horaFin.slice(0, 5)}
                        {t.horaFin < t.horaInicio && " (cruza medianoche)"}
                      </span>
                      {/* La lista de gente ya NO va acá: está en cada celda del
                          día, que es donde hace falta. Repetirla aquí sería
                          decir dos veces lo mismo en la misma fila. */}
                      <button
                        type="button"
                        aria-expanded={abierto === t.id}
                        onClick={() => setAbierto(abierto === t.id ? null : t.id)}
                        style={{ ...botonMenudo, marginTop: "8px" }}
                      >
                        {abierto === t.id ? "Cerrar" : "Gestionar"}
                      </button>
                    </th>

                    {DIAS.map((nombreDia, d) => {
                      const trabaja = t.dias.includes(d);

                      if (!trabaja) {
                        // Un día libre se dibuja vacío. Un guión o un punto
                        // gris es tinta que hay que descartar leyendo, y son
                        // dos de cada siete.
                        return (
                          <td key={d} className="turnos-celda">
                            <span className="solo-lectores">{nombreDia}: libre</span>
                          </td>
                        );
                      }

                      return (
                        <td key={d} className="turnos-celda turnos-celda-activa">
                          {nombres.length === 0 ? (
                            <span className="turnos-vacante">
                              sin
                              <br />
                              asignar
                            </span>
                          ) : (
                            nombres.map((n) => (
                              <span key={n} className="turnos-nombre">
                                {n}
                              </span>
                            ))
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {abierto === t.id && (
                    <tr>
                      <td colSpan={8} className="turnos-gestion">
                        <div style={{ display: "flex", gap: "9px", alignItems: "center", flexWrap: "wrap" }}>
                          <form action={accion}>
                            <input type="hidden" name="accion" value={t.activo ? "desactivar" : "activar"} />
                            <input type="hidden" name="turnoId" value={t.id} />
                            <button type="submit" disabled={enviando} style={deshabilitado(botonMenudo, enviando)}>
                              {t.activo ? "Desactivar el turno" : "Activar el turno"}
                            </button>
                          </form>
                          <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>
                            {t.activo
                              ? "Desactivado deja de poder abrirse en la taquilla; lo ya trabajado se conserva."
                              : "Está desactivado: no se puede abrir en la taquilla."}
                          </span>
                        </div>

                        {t.personas.length > 0 && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {t.personas.map((persona) => (
                              <form key={persona.id} action={accion}>
                                <input type="hidden" name="accion" value="retirar" />
                                <input type="hidden" name="turnoId" value={t.id} />
                                <input type="hidden" name="usuarioId" value={persona.id} />
                                <button
                                  type="submit"
                                  aria-label={`Retirar a ${persona.nombre} del turno ${t.nombre}`}
                                  style={botonMenudo}
                                >
                                  {persona.codigo ? `${persona.codigo} · ` : ""}
                                  {persona.nombre}
                                  <span aria-hidden="true" style={{ opacity: 0.55 }}>✕</span>
                                </button>
                              </form>
                            ))}
                          </div>
                        )}

                        <form action={accion} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <input type="hidden" name="accion" value="asignar" />
                          <input type="hidden" name="turnoId" value={t.id} />
                          <select
                            name="usuarioId"
                            required
                            aria-label={`Asignar a alguien al turno ${t.nombre}`}
                            style={{ ...campoTexto, minWidth: "12rem", width: "auto", padding: "8px 12px", fontSize: "13px" }}
                          >
                            <option value="">Asignar a alguien…</option>
                            {gente
                              .filter((g) => !t.personas.some((persona) => persona.id === g.id))
                              .map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.codigo ? `${g.codigo} · ` : ""}
                                  {g.nombre}
                                </option>
                              ))}
                          </select>
                          <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
                            Asignar
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {turnos.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "14px 18px", color: "var(--texto-tenue)", fontSize: "13px" }}>
                    Todavía no hay turnos declarados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* ── Nuevo turno ───────────────────────────────────────────────── */}
      {creando && (
        <form action={accion} style={{ ...tarjeta, display: "grid", gap: "14px", marginTop: "22px", padding: "22px", maxWidth: "34rem" }}>
          <input type="hidden" name="accion" value="crear" />
          <label style={{ display: "grid", gap: "7px" }}>
            <span style={etiqueta}>Nombre</span>
            <input name="nombre" required placeholder="Mañana, Turno 1, Nocturno…" style={campoTexto} />
          </label>
          <div style={{ display: "flex", gap: "11px", alignItems: "center", flexWrap: "wrap" }}>
            <input name="horaInicio" type="time" required defaultValue="07:00" aria-label="Hora de inicio" style={campoTexto} />
            <span style={{ color: "var(--texto-tenue)", fontSize: "13px" }}>a</span>
            <input name="horaFin" type="time" required defaultValue="15:00" aria-label="Hora de fin" style={campoTexto} />
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {DIAS.map((d, i) => (
              <label key={d} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="checkbox"
                  name={`dia-${i}`}
                  value="si"
                  defaultChecked={i >= 1 && i <= 5}
                  style={{ width: "17px", height: "17px", accentColor: "var(--marca)" }}
                />
                <span style={{ fontSize: "14px" }}>{d}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="submit" disabled={enviando} style={deshabilitado(botonPrimario, enviando)}>
              {enviando ? "Creando…" : "Crear turno"}
            </button>
            {turnos.length > 0 && (
              <button type="button" onClick={() => setCreando(false)} style={botonSecundario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {/*
        T080: los huecos de atención sin nadie asignado.
        ───────────────────────────────────────────────
        Avisa, no impide: se puede dejar la configuración a medias y volver
        después. Por eso baja al PIE y no abre la pantalla — quien entra viene
        a ver o a tocar el cuadrante, y siete franjas horarias encadenadas con
        puntos medios delante de todo eran un párrafo que había que leer entero
        para descubrir que no pedía nada urgente.

        Y va en lista, una franja por renglón. Encadenadas —"domingo de 07:00
        a. m. a 08:00 p. m. · lunes de 03:00 p. m. a…"— no se puede localizar
        un día sin releer la frase entera.
      */}
      {sinCubrir.length > 0 && (
        <section style={{ marginTop: "44px" }}>
          <h2 className="rotulo-filete" style={{ ...rotuloSeccion, color: "var(--aviso-tinta)" }}>
            Horas sin cubrir
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--texto-tenue)", maxWidth: "52em" }}>
            El parqueadero atiende en estas franjas y ningún turno las tiene marcada con gente
            asignada. Se puede dejar así: nadie queda bloqueado, pero esas horas no van a quedar
            atribuidas a ningún turno.
          </p>
          <ul className="turnos-huecos">
            {sinCubrir.map((franja) => (
              <li key={franja}>{franja}</li>
            ))}
          </ul>
          {huecosDeMas > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
              y {huecosDeMas} {huecosDeMas === 1 ? "franja más" : "franjas más"}.
            </p>
          )}
        </section>
      )}
    </>
  );
}

const cabecera: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  paddingBottom: "22px",
  marginBottom: "30px",
  borderBottom: "1px solid var(--borde)",
};

/** Un turno declarado: contorno de un píxel, sin relleno. Es un objeto que se
    edita, así que aquí el contorno sí dice algo. */
const tarjeta: React.CSSProperties = {
  border: "1px solid var(--borde)",
  borderRadius: "12px",
  padding: "16px 18px",
};

/**
 * El aviso de cobertura: texto y nada más.
 *
 * Lo hace notar su primera frase en negrita sobre un párrafo tenue. Avisa, no
 * impide —se puede dejar la configuración a medias y volver después—, así que
 * tampoco debe verse como algo que bloquea.
 */

const encabezadoCelda: React.CSSProperties = {
  padding: "0 6px 10px",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
  borderBottom: "1px solid var(--borde-control)",
  textAlign: "center",
};


const etiqueta: React.CSSProperties = { fontSize: "13px", fontWeight: 600 };
