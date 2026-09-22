"use client";

import { useActionState, useState } from "react";
import { accionSobreEquipo, type EstadoEquipo } from "./acciones";
import {
  botonMenudo,
  botonPeligro,
  botonPrimario,
  botonSecundario,
  campoTexto,
  cifra,
  deshabilitado,
  insignia,
  pieza,
  rotuloSeccion,
  textoTenue,
  tituloPantalla,
} from "@/app/ui";
import type { RolUsuario } from "@/db/esquema";

const ROL: Record<string, string> = {
  admin_parqueadero: "Administrador",
  operario: "Operario",
};

export type Miembro = {
  id: string;
  codigo: string | null;
  nombre: string;
  email: string;
  rol: RolUsuario | null;
  bloqueada: boolean;
  motivoBloqueo: string | null;
  debeCambiarPassword: boolean;
  anonimizadaEn: Date | null;
  /** Pesos cobrados en los últimos siete días. */
  vendido: number;
  turnos: string[];
  enTurno: boolean;
};

/**
 * Operarios del establecimiento (maqueta 8c).
 *
 * Tres desvíos de la maqueta, todos por el mismo motivo —no repetir lo mismo
 * dos veces en una pantalla que cabe entera sin desplazarse—:
 *
 * 1. **Una sola lista.** La versión anterior traía la tabla y, debajo,
 *    "Acciones sobre cada cuenta": las mismas personas otra vez, cada una en su
 *    recuadro con cinco botones. Con seis operarios eran treinta botones
 *    visibles a la vez. Ahora cada fila despliega los suyos.
 *
 * 2. **La barra de lo vendido vive en su celda.** La maqueta la dibuja en un
 *    panel aparte, al lado de la misma cifra que ya está en la columna.
 *
 * 3. **El aviso no inventa.** La maqueta redacta "cinco intentos fallidos el
 *    09/08"; el sistema no cuenta intentos fallidos, así que dice lo que sí
 *    sabe: que está bloqueada, y que el bloqueo no se vence solo.
 */
export function PanelEquipo({
  equipo,
  yo,
  esAdministrador,
  puedenCorregir,
}: {
  equipo: Miembro[];
  yo: string;
  esAdministrador: boolean;
  /**
   * Quiénes tienen delegado el permiso de corregir cobros.
   *
   * Se muestra siempre, incluso a quien no puede cambiarlo: saber quién tiene
   * la llave de la caja no es un privilegio, es información que todo el equipo
   * debería poder ver.
   */
  puedenCorregir: string[];
}) {
  const [estado, accion, enviando] = useActionState(accionSobreEquipo, {} as EstadoEquipo);
  const [dandoAlta, setDandoAlta] = useState(equipo.length <= 1);
  // Una sola fila abierta a la vez. Con varias, la lista se convierte otra vez
  // en la pila de botones que este rediseño vino a quitar.
  const [abierta, setAbierta] = useState<string | null>(null);

  const activos = equipo.filter((m) => m.anonimizadaEn === null);
  const requierenAtencion = activos.filter((m) => m.bloqueada || m.debeCambiarPassword);
  const maximoVendido = Math.max(...equipo.map((m) => m.vendido), 1);

  return (
    <>
      {/* La cabecera vive acá y no en la página porque el botón que la
          acompaña abre el formulario, y ese estado es del cliente. */}
      <header className="cabecera-pantalla">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...tituloPantalla, margin: 0 }}>Operarios</h1>
          <p style={{ ...textoTenue, margin: "10px 0 0", maxWidth: "46em" }}>
            {equipo.length} {equipo.length === 1 ? "cuenta" : "cuentas"} · sólo las de este
            establecimiento. Las que cree aquí no existen en ningún otro.
          </p>
        </div>
        {!dandoAlta && (
          <button type="button" onClick={() => setDandoAlta(true)} style={botonPrimario}>
            Nuevo operario
          </button>
        )}
      </header>

      {estado.error && (
        <p role="alert" style={mensaje("error")}>
          {estado.error}
        </p>
      )}

      {/* El alta sale donde se pidió, arriba, y no al final de la pantalla:
          es la respuesta al botón que se acaba de pulsar. */}
      {dandoAlta && (
        <form action={accion} style={{ ...pieza, display: "grid", gap: "16px", maxWidth: "34rem", marginBottom: "34px" }}>
          <input type="hidden" name="accion" value="crear" />
          <h2 className="rotulo-filete" style={{ ...rotuloSeccion, margin: 0 }}>
            Dar de alta
          </h2>
          <Campo etiqueta="Nombre"><input name="nombre" required style={campoTexto} /></Campo>
          <Campo etiqueta="Correo"><input name="email" type="email" required style={campoTexto} /></Campo>
          <Campo
            etiqueta="Contraseña temporal"
            ayuda="Se la entrega usted por fuera del sistema. Se le exigirá cambiarla al entrar."
          >
            <input name="passwordTemporal" required minLength={10} style={campoTexto} />
          </Campo>
          <Campo etiqueta="Rol">
            <select name="rol" defaultValue="operario" style={campoTexto}>
              <option value="operario">Operario de taquilla</option>
              <option value="admin_parqueadero">Administrador del parqueadero</option>
            </select>
          </Campo>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="submit" disabled={enviando} style={deshabilitado(botonPrimario, enviando)}>
              {enviando ? "Creando…" : "Crear cuenta"}
            </button>
            {equipo.length > 1 && (
              <button type="button" onClick={() => setDandoAlta(false)} style={botonSecundario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {requierenAtencion.length > 0 && (
        <section style={{ marginBottom: "34px" }}>
          <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "14px" }}>
            Requiere atención
          </h2>
          <div style={{ display: "grid", gap: "10px" }}>
            {requierenAtencion.map((m) => (
              <Atencion
                key={m.id}
                miembro={m}
                accion={accion}
                enviando={enviando}
                esYo={m.id === yo}
              />
            ))}
          </div>
        </section>
      )}

      <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "10px" }}>
        Equipo
      </h2>

      <div className="tabla-desliza">
        <div className="equipo-tabla">
          <div className="cabecera-tabla equipo-rejilla">
            <span>Código</span>
            <span>Nombre</span>
            <span>Correo</span>
            <span style={{ textAlign: "right" }}>Vendido (7d)</span>
            <span style={{ textAlign: "right" }}>Estado</span>
            <span />
          </div>

          <ul className="filas filas-vivas" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {equipo.map((m) => {
              const retirada = m.anonimizadaEn !== null;
              const gestionable = m.id !== yo && !retirada;

              return (
                <li key={m.id} style={{ opacity: m.bloqueada || retirada ? 0.62 : 1 }}>
                  <div className="equipo-rejilla">
                    <code style={{ ...cifra, fontWeight: 700, color: "var(--acento)", fontSize: "13px" }}>
                      {m.codigo ?? "—"}
                    </code>
                    <span style={{ fontWeight: 600, fontSize: "14px", minWidth: 0 }}>
                      {m.nombre}
                      {m.id === yo && (
                        <span style={{ color: "var(--texto-tenue)", fontWeight: 400 }}> · usted</span>
                      )}
                      {/* Rol, turno y delegación en un renglón bajo el nombre.
                          La maqueta le da columna propia al turno; acá va
                          junto al rol porque describe a la persona igual que
                          él, y la columna que se libera es la que hacía que la
                          tabla no cupiera en el ancho de la propia maqueta. */}
                      <span style={{ display: "block", fontSize: "12px", fontWeight: 400, color: "var(--texto-tenue)" }}>
                        {[
                          m.rol ? ROL[m.rol] : "Sin rol",
                          m.turnos.length > 0 ? m.turnos.join(", ") : "sin turno asignado",
                          ...(puedenCorregir.includes(m.id) ? ["corrige cobros"] : []),
                        ].join(" · ")}
                      </span>
                    </span>
                    <span style={{ fontSize: "13px", color: "var(--texto-tenue)", minWidth: 0, overflowWrap: "anywhere" }}>
                      {m.email}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span style={{ ...cifra, fontSize: "13px" }}>{pesos(m.vendido)}</span>
                      {/* La barra sustituye al panel de la maqueta: la misma
                          comparación, sin repetir la cifra en otro sitio. */}
                      {m.vendido > 0 && (
                        <span
                          className={
                            m.vendido === maximoVendido ? "equipo-barra equipo-barra-alta" : "equipo-barra"
                          }
                          style={{ width: `${Math.max(6, (m.vendido / maximoVendido) * 100)}%`, marginLeft: "auto" }}
                        />
                      )}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <Estado miembro={m} />
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {gestionable && (
                        <button
                          type="button"
                          aria-expanded={abierta === m.id}
                          onClick={() => setAbierta(abierta === m.id ? null : m.id)}
                          style={botonMenudo}
                        >
                          {abierta === m.id ? "Cerrar" : "Gestionar"}
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Nadie puede bloquearse ni degradarse a sí mismo: quedaría
                      fuera de su propio establecimiento sin quien lo restituya.
                      Por eso la propia fila no tiene "Gestionar". */}
                  {gestionable && abierta === m.id && (
                    <div className="equipo-acciones">
                      <Simple accion={accion} enviando={enviando} id={m.id}
                        tipo={m.bloqueada ? "desbloquear" : "bloquear"}
                        texto={m.bloqueada ? "Desbloquear" : "Bloquear"} />
                      <Restablecer accion={accion} enviando={enviando} id={m.id} />
                      <CambiarRol accion={accion} enviando={enviando} id={m.id} rol={m.rol} />
                      {/* La delegación de corregir cobros. Sólo la reparte un
                          administrador, y sólo a operarios: un administrador ya
                          puede corregir por su rol.

                          No asciende a nadie. Existe porque un parqueadero
                          pequeño tiene un operario de confianza en el turno de
                          noche y ningún administrador despierto, y negarle una
                          corrección hasta la mañana es una regla que la
                          operación real termina saltándose por fuera del
                          sistema. */}
                      {esAdministrador && m.rol === "operario" && (
                        <Simple
                          accion={accion}
                          enviando={enviando}
                          id={m.id}
                          tipo={puedenCorregir.includes(m.id) ? "revocar_correccion" : "delegar_correccion"}
                          texto={
                            puedenCorregir.includes(m.id)
                              ? "Quitar permiso de corregir"
                              : "Permitir corregir cobros"
                          }
                          pregunta={
                            puedenCorregir.includes(m.id)
                              ? "¿Quitarle el permiso de corregir cobros? Las correcciones que ya emitió se conservan."
                              : "¿Autorizar a esta persona a corregir cobros ya cerrados? Queda registrado que usted la autorizó."
                          }
                        />
                      )}
                      <Simple accion={accion} enviando={enviando} id={m.id} tipo="dar_de_baja"
                        texto="Dar de baja" peligro
                        pregunta="¿Confirma dar de baja esta cuenta? El historial de lo que hizo se conserva." />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

/**
 * Lo que hay que resolver, arriba y con sus dos botones a la mano.
 *
 * Es el panel que la maqueta pone abajo a la derecha, subido: una cuenta
 * bloqueada impide trabajar un turno entero, y enterarse al final de la
 * pantalla es enterarse tarde.
 */
function Atencion({
  miembro, accion, enviando, esYo,
}: { miembro: Miembro; accion: (f: FormData) => void; enviando: boolean; esYo: boolean }) {
  const bloqueada = miembro.bloqueada;

  return (
    <div style={pieza}>
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
        {miembro.nombre}
        {miembro.codigo && (
          <span style={{ ...cifra, fontWeight: 700, color: "var(--acento)", marginLeft: "8px", fontSize: "13px" }}>
            {miembro.codigo}
          </span>
        )}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--texto-tenue)", lineHeight: 1.55 }}>
        {bloqueada ? (
          <>
            La cuenta está bloqueada
            {miembro.motivoBloqueo ? `: ${miembro.motivoBloqueo.toLowerCase()}. ` : ". "}
            El bloqueo no vence solo: hay que desbloquearla o restablecerle la contraseña.
          </>
        ) : (
          <>
            Todavía usa la contraseña temporal que se le entregó. Hasta que la cambie, esa clave
            es la única que protege la caja de este establecimiento.
          </>
        )}
      </p>
      {!esYo && (
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          {bloqueada && (
            <Simple accion={accion} enviando={enviando} id={miembro.id}
              tipo="desbloquear" texto="Desbloquear" />
          )}
          <Restablecer accion={accion} enviando={enviando} id={miembro.id} />
        </div>
      )}
    </div>
  );
}

function Simple({
  accion, enviando, id, tipo, texto, peligro = false, pregunta,
}: {
  accion: (f: FormData) => void; enviando: boolean; id: string;
  tipo: string; texto: string; peligro?: boolean; pregunta?: string;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="accion" value={tipo} />
      <input type="hidden" name="usuarioId" value={id} />
      <button
        type="submit"
        disabled={enviando}
        onClick={(e) => {
          if (pregunta && !confirm(pregunta)) e.preventDefault();
        }}
        style={deshabilitado(peligro ? botonPeligro : botonSecundario, enviando)}
      >
        {texto}
      </button>
    </form>
  );
}

function Restablecer({
  accion, enviando, id,
}: { accion: (f: FormData) => void; enviando: boolean; id: string }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} style={botonSecundario}>
        Restablecer contraseña
      </button>
    );
  }

  return (
    <form action={accion} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <input type="hidden" name="accion" value="restablecer" />
      <input type="hidden" name="usuarioId" value={id} />
      <input
        name="passwordTemporal"
        placeholder="Nueva temporal"
        required
        minLength={10}
        autoComplete="off"
        style={{ ...campoTexto, fontSize: "14px", width: "auto" }}
      />
      <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
        Guardar
      </button>
    </form>
  );
}

function CambiarRol({
  accion, enviando, id, rol,
}: { accion: (f: FormData) => void; enviando: boolean; id: string; rol: RolUsuario | null }) {
  const destino = rol === "admin_parqueadero" ? "operario" : "admin_parqueadero";

  return (
    <form action={accion}>
      <input type="hidden" name="accion" value="cambiar_rol" />
      <input type="hidden" name="usuarioId" value={id} />
      <input type="hidden" name="rol" value={destino} />
      <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
        {destino === "admin_parqueadero" ? "Hacer administrador" : "Pasar a operario"}
      </button>
    </form>
  );
}

function Campo({
  etiqueta, ayuda, children,
}: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{etiqueta}</span>
      {children}
      {ayuda && <span style={{ fontSize: "13px", color: "var(--texto-tenue)" }}>{ayuda}</span>}
    </label>
  );
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/** Sin recuadro ni relleno de color: sólo el texto en el color que le toca. */
function mensaje(tipo: "error" | "ok"): React.CSSProperties {
  return {
    margin: "0 0 20px",
    fontSize: "13px",
    fontWeight: 600,
    color: tipo === "error" ? "var(--error-texto)" : "var(--marca-texto)",
  };
}

/**
 * El estado de una cuenta, en una sola insignia.
 *
 * El orden NO es alfabético: es de gravedad. Una cuenta bloqueada que además
 * tiene contraseña temporal se muestra como bloqueada, porque eso es lo que
 * impide trabajar y lo otro es un detalle que se resuelve después.
 *
 * "Corrige cobros" salió de acá y pasó a leerse bajo el nombre, junto al rol:
 * es una atribución permanente de la persona, no un estado de su cuenta, y
 * ocupando la columna tapaba a "En turno", que sí cambia durante el día.
 */
function Estado({ miembro }: { miembro: Miembro }) {
  if (miembro.anonimizadaEn !== null) {
    return <span style={{ ...insignia, background: "var(--borde)", color: "var(--texto)" }}>Retirada</span>;
  }
  if (miembro.bloqueada) {
    return <span style={{ ...insignia, background: "var(--error-texto)", color: "var(--fondo)" }}>Bloqueada</span>;
  }
  if (miembro.debeCambiarPassword) {
    return (
      <span style={{ ...insignia, background: "var(--aviso-fondo)", color: "var(--aviso-texto)" }}>
        Clave temporal
      </span>
    );
  }
  if (miembro.enTurno) {
    return <span style={{ ...insignia, background: "var(--marca)", color: "var(--marca-sobre)" }}>En turno</span>;
  }
  return <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>Activa</span>;
}
