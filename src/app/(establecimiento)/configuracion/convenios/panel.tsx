"use client";

import { useActionState, useState } from "react";
import type {
  ActivacionConvenio,
  BeneficioConvenio,
  PeriodicidadConvenio,
} from "@/db/esquema";
import { NOMBRE_PERIODICIDAD } from "@/dominio/convenios/vigencia";
import {
  accionSobreConvenios,
  consultarPlaca,
  type EstadoConsulta,
  type EstadoConvenios,
} from "./acciones";
import {
  botonMenudo,
  botonPeligro,
  botonPrimario,
  botonSecundario,
  campoTexto,
  cifra,
  deshabilitado,
  rotuloSeccion,
  textoTenue,
  tituloPantalla,
} from "@/app/ui";

export type ConvenioVisible = {
  id: string;
  nombre: string;
  activacion: ActivacionConvenio;
  beneficio: BeneficioConvenio;
  descripcion: string;
  declaradoPorSoporte: boolean;
  desde: Date;
  hasta: Date | null;
  activo: boolean;
  placas: string[];
};

/** Qué hace cada beneficio, dicho para quien no piensa en "beneficios". */
const BENEFICIO: Record<BeneficioConvenio, { etiqueta: string; ayuda: string; unidad?: string }> = {
  minutos_gratis: {
    etiqueta: "Regala tiempo",
    ayuda: "Se descuentan del tiempo cobrable, no del importe: una hora gratis vale distinto según la tarifa.",
    unidad: "minutos",
  },
  porcentaje: {
    etiqueta: "Descuenta un porcentaje",
    ayuda: "Sobre el total. Si aplican varios convenios, los porcentajes se suman.",
    unidad: "%",
  },
  tarifa_fija: {
    etiqueta: "Cobra un valor fijo",
    ayuda: "Se cobra ese importe y no se calcula nada más.",
    unidad: "pesos",
  },
  sin_cobro: {
    etiqueta: "No cobra la salida",
    ayuda: "La forma de una mensualidad: ya pagó por fuera del sistema.",
  },
};

const ACTIVACION: Record<ActivacionConvenio, { etiqueta: string; ayuda: string }> = {
  sello: {
    etiqueta: "Con sello en el ticket",
    ayuda: "Quien atiende la taquilla lo confirma al momento de la salida, viendo el sello del comercio.",
  },
  placa: {
    etiqueta: "Por placa registrada",
    ayuda: "Se aplica solo a las placas que se agreguen abajo. Una placa pertenece a un solo convenio.",
  },
};

const fecha = (d: Date) => new Date(d).toLocaleDateString("es-CO", { dateStyle: "medium" });

const vigente = (c: ConvenioVisible) =>
  c.activo && (c.hasta === null || new Date(c.hasta) > new Date());

export function PanelConvenios({
  convenios,
  uso,
  administra,
}: {
  convenios: ConvenioVisible[];
  /**
   * Cuánto se usó cada convenio este mes y cuánto se dejó de cobrar por él.
   *
   * Llega como Map y no dentro de cada convenio porque son dos preguntas
   * distintas —qué acordamos, y cuánto está costando— y la lista se usa también
   * donde la segunda no hace falta.
   */
  uso: Map<string, { usos: number; sinCobrar: number }>;
  /**
   * Quien mira administra el establecimiento.
   *
   * Un operario ve esta pantalla, pero sólo para saber QUÉ convenios están
   * vigentes y qué hace cada uno: es lo que necesita para responderle a un
   * cliente que dice tener convenio. No ve cuánto se ha dejado de cobrar ni
   * las placas de nadie, y no declara, edita ni vence ninguno.
   *
   * Es comodidad, no control de acceso: las cuatro acciones exigen
   * `parqueadero.editar.propio` en el dominio, que un operario no tiene.
   */
  administra: boolean;
}) {
  const [estado, accion, enviando] = useActionState(accionSobreConvenios, {} as EstadoConvenios);

  const activos = convenios.filter(vigente);
  const vencidos = convenios.filter((c) => !vigente(c));
  const [registrando, setRegistrando] = useState(convenios.length === 0);
  const [activacion, setActivacion] = useState<ActivacionConvenio>("sello");
  const [beneficio, setBeneficio] = useState<BeneficioConvenio>("minutos_gratis");
  const [limite, setLimite] = useState<"sin_limite" | "con_limite">("sin_limite");
  const [vigencia, setVigencia] = useState<"sin_vencimiento" | "duracion" | "fecha">(
    "sin_vencimiento",
  );
  // Un convenio abierto a la vez. Con varios, la lista vuelve a ser la pila de
  // cuatrocientas pastillas que este rediseño vino a quitar.
  const [abierto, setAbierto] = useState<string | null>(null);

  // La rejilla tiene siete columnas para quien administra y tres para quien
  // sólo mira. Va como clase y no como estilo incrustado porque la plantilla
  // la comparten cabecera y filas, y un `style` no la puede heredar.
  const rejilla = administra ? "convenios-rejilla" : "convenios-rejilla convenios-rejilla-lectura";

  return (
    <>
      {/* La cabecera vive acá y no en la página porque el botón que la
          acompaña abre el formulario, y ese estado es del cliente. */}
      <header className="cabecera-pantalla">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...tituloPantalla, margin: 0 }}>Convenios</h1>
          <p style={{ ...textoTenue, margin: "10px 0 0", maxWidth: "52em" }}>
            Descuentos para clientes habituales. Se aplican al cobrar en la taquilla; aquí sólo se
            declaran.
          </p>
        </div>
        {administra && !registrando && (
          <button type="button" onClick={() => setRegistrando(true)} style={botonPrimario}>
            Nuevo convenio
          </button>
        )}
      </header>

      {/*
        El alta sale ARRIBA, donde se pulsó el botón, y no al final de la
        pantalla. Es la respuesta a lo que se acaba de pedir; con el
        formulario al fondo había que buscarlo después de pulsar, y estando
        siempre abierto metía siete campos entre la lista y las herramientas.
      */}
      {administra && registrando && (
        <form action={accion} style={{ display: "grid", gap: "18px", maxWidth: "34rem" }}>
          <input type="hidden" name="accion" value="registrar" />

          <Campo etiqueta="Nombre" ayuda="El comercio o el motivo: Fruver La Esquina, Vecinos, Mensualidad Torre B.">
            <input name="nombre" required style={campoTexto} />
          </Campo>

          <Campo etiqueta="Cuándo aplica" ayuda={ACTIVACION[activacion].ayuda}>
            <select
              name="activacion"
              value={activacion}
              onChange={(e) => setActivacion(e.target.value as ActivacionConvenio)}
              style={campoTexto}
            >
              {(Object.keys(ACTIVACION) as ActivacionConvenio[]).map((a) => (
                <option key={a} value={a}>{ACTIVACION[a].etiqueta}</option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Qué hace" ayuda={BENEFICIO[beneficio].ayuda}>
            <select
              name="beneficio"
              value={beneficio}
              onChange={(e) => setBeneficio(e.target.value as BeneficioConvenio)}
              style={campoTexto}
            >
              {(Object.keys(BENEFICIO) as BeneficioConvenio[]).map((b) => (
                <option key={b} value={b}>{BENEFICIO[b].etiqueta}</option>
              ))}
            </select>
          </Campo>

          {/* El campo del valor sólo existe si el beneficio lo pide. "Sin cobro"
              no lleva ninguno, y mandarlo en cero sería declarar que se cobra
              cero, que no es lo mismo. */}
          {BENEFICIO[beneficio].unidad && (
            <Campo etiqueta={`Cuánto (${BENEFICIO[beneficio].unidad})`}>
              <input
                name="valor"
                type="number"
                min={beneficio === "tarifa_fija" ? 0 : 1}
                max={beneficio === "porcentaje" ? 100 : undefined}
                required
                style={{ ...campoTexto, ...cifra }}
              />
            </Campo>
          )}

          <Campo etiqueta="Tope en pesos" ayuda="Lo máximo que puede descontar en una salida. Déjelo en blanco si no tiene tope.">
            <input name="topePesos" type="number" min={1} style={{ ...campoTexto, ...cifra }} />
          </Campo>

          {/* "Sin límite" se elige, no se deduce de un campo vacío: un blanco no
              distingue "quiero que sea ilimitado" de "se me olvidó llenarlo", y
              en algo que descuenta dinero esa diferencia importa. */}
          {/* Sin recuadro: el grupo lo hace el título del propio conjunto y el
              aire de arriba. */}
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontSize: "14px", fontWeight: 500, padding: "0 6px" }}>
              Cuántas veces al día puede usarla una misma placa
            </legend>
            <label style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <input
                type="radio"
                name="limite"
                value="sin_limite"
                checked={limite === "sin_limite"}
                onChange={() => setLimite("sin_limite")}
                style={{ accentColor: "var(--marca)" }}
              />
              <span style={{ fontSize: "14px" }}>Sin límite</span>
            </label>
            <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="radio"
                name="limite"
                value="con_limite"
                checked={limite === "con_limite"}
                onChange={() => setLimite("con_limite")}
                style={{ accentColor: "var(--marca)" }}
              />
              <span style={{ fontSize: "14px" }}>Como máximo</span>
              <input
                name="limiteDiario"
                type="number"
                min={1}
                defaultValue={1}
                disabled={limite !== "con_limite"}
                aria-label="Veces al día"
                style={{ ...campoTexto, ...cifra, width: "6rem", opacity: limite === "con_limite" ? 1 : 0.5 }}
              />
              <span style={{ fontSize: "14px", color: "var(--texto-tenue)" }}>veces al día</span>
            </label>
          </fieldset>

          {/* Apagado por defecto, y a propósito: un convenio se pactó pensando
              en los carros del comercio de al lado. Extenderlo a las bicicletas
              sin que nadie lo pidiera regalaría dinero en silencio, así que
              tiene que ser una decisión y no un descuido. */}
          <label style={{ display: "flex", gap: "9px", alignItems: "baseline", padding: "4px 0" }}>
            <input
              type="checkbox"
              name="aplicaBicicletas"
              value="si"
              style={{ accentColor: "var(--marca)" }}
            />
            <span style={{ fontSize: "14px" }}>
              También cubre bicicletas
              <span style={{ display: "block", fontSize: "12px", color: "var(--texto-tenue)" }}>
                Sin marcar, este convenio sólo alcanza a los vehículos con placa
              </span>
            </span>
          </label>

          {/* Tres formas de decir hasta cuándo, y se elige una. Antes había un
              solo campo de fecha, que obligaba a traducir "mensualidad" a un
              día del calendario: una cuenta que el sistema hace mejor y que
              nadie debería tener que hacer a mano. */}
          {/* Sin recuadro: el grupo lo hace el título del propio conjunto y el
              aire de arriba. */}
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontSize: "14px", fontWeight: 500, padding: "0 6px" }}>
              Hasta cuándo vale
            </legend>

            <label style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <input
                type="radio" name="vigencia" value="sin_vencimiento"
                checked={vigencia === "sin_vencimiento"}
                onChange={() => setVigencia("sin_vencimiento")}
                style={{ accentColor: "var(--marca)" }}
              />
              <span style={{ fontSize: "14px" }}>Sin vencimiento</span>
            </label>

            <label style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
              <input
                type="radio" name="vigencia" value="duracion"
                checked={vigencia === "duracion"}
                onChange={() => setVigencia("duracion")}
                style={{ accentColor: "var(--marca)" }}
              />
              <span style={{ fontSize: "14px" }}>Dura</span>
              <select
                name="periodicidad"
                disabled={vigencia !== "duracion"}
                aria-label="Duración del convenio"
                style={{ ...campoTexto, width: "auto", opacity: vigencia === "duracion" ? 1 : 0.5 }}
              >
                {(Object.keys(NOMBRE_PERIODICIDAD) as PeriodicidadConvenio[]).map((d) => (
                  <option key={d} value={d}>{NOMBRE_PERIODICIDAD[d]}</option>
                ))}
              </select>
              <span style={{ fontSize: "13px", color: "var(--texto-tenue)" }}>
                y el vencimiento se calcula solo
              </span>
            </label>

            <label style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="radio" name="vigencia" value="fecha"
                checked={vigencia === "fecha"}
                onChange={() => setVigencia("fecha")}
                style={{ accentColor: "var(--marca)" }}
              />
              <span style={{ fontSize: "14px" }}>Vence el</span>
              <input
                name="hasta" type="date"
                disabled={vigencia !== "fecha"}
                aria-label="Fecha de vencimiento"
                style={{ ...campoTexto, width: "auto", opacity: vigencia === "fecha" ? 1 : 0.5 }}
              />
            </label>
          </fieldset>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="submit" disabled={enviando} style={deshabilitado(botonPrimario, enviando)}>
              {enviando ? "Registrando…" : "Registrar"}
            </button>
            {convenios.length > 0 && (
              <button type="button" onClick={() => setRegistrando(false)} style={botonSecundario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {estado.error && (
        <p role="alert" style={{ margin: "0 0 26px", color: "var(--error-texto)", fontSize: "14px" }}>
          {estado.error}
        </p>
      )}

      {/* Vigentes y vencidos van SEPARADOS y no mezclados con distinta
          opacidad. Un convenio vencido no es "el mismo pero apagado": ya no
          descuenta nada, y confundirlo con uno vivo delante de un cliente es
          prometer un precio que la taquilla no va a cobrar. */}
      <h2 className="rotulo-filete" style={rotuloSeccion}>
        Vigentes ({activos.length})
      </h2>

      {activos.length === 0 ? (
        <p style={{ margin: "0 0 30px", fontSize: "15px", color: "var(--texto-tenue)", maxWidth: "52em" }}>
          Todavía no hay convenios vigentes. Un parqueadero funciona perfectamente sin ninguno: se
          cobra tarifa plena a todo el mundo.
        </p>
      ) : (
        /*
          Los convenios, en columnas comparables.
          ───────────────────────────────────────
          Antes cada uno era un bloque suelto con sus cuatro cifras repartidas
          en una fila flexible, así que "sin cobrar" caía en un sitio distinto
          en cada convenio y no se podían comparar de un barrido. Y eso es
          justo lo que se viene a hacer acá: ver cuál está costando más.

          Las placas ya no se dibujan todas. Un convenio de empresa tiene
          ciento veintiocho, y tres convenios así llenaban la pantalla de
          cuatrocientas pastillas antes de llegar al primer dato. Se abren por
          convenio, con "Gestionar", junto a lo demás que se hace sobre él.
        */
        <div className="tabla-desliza" style={{ marginBottom: "44px" }}>
          {/* Papeles ARIA de tabla.
              No es un `<table>` de verdad porque una tabla de HTML no se
              maqueta con rejilla sin pelearse con su modelo de cajas. Sin
              estos papeles, un lector de pantalla anuncia "128", "412",
              "$1.284.600" sueltos, sin decir de qué columna es cada uno. */}
          <div className="convenios-tabla" role="table" aria-label="Convenios vigentes">
            <div role="row" className={rejilla + " cabecera-tabla"}>
              <span role="columnheader">Convenio</span>
              <span role="columnheader">Qué hace</span>
              {administra && (
                <>
                  <span role="columnheader" style={{ textAlign: "right" }}>Placas</span>
                  <span role="columnheader" style={{ textAlign: "right" }}>Usos</span>
                  <span role="columnheader" style={{ textAlign: "right" }}>Sin cobrar</span>
                </>
              )}
              <span role="columnheader">Vence</span>
              {administra && <span role="columnheader" aria-label="Acciones" />}
            </div>

            <ul role="rowgroup" className="filas filas-vivas" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {activos.map((c) => {
                const suUso = uso.get(c.id);
                const porSello = c.activacion === "sello";

                return (
                  <li key={c.id}>
                    <div role="row" className={rejilla}>
                      <span role="cell" style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: "15px" }}>{c.nombre}</strong>
                        {c.declaradoPorSoporte && (
                          <span
                            title="Lo declaró el administrador de la plataforma, no este establecimiento"
                            style={{ display: "block", fontSize: "12px", color: "var(--texto-tenue)" }}
                          >
                            declarado por soporte
                          </span>
                        )}
                        <span style={{ display: "block", fontSize: "12px", color: "var(--texto-tenue)" }}>
                          desde el {fecha(c.desde)}
                        </span>
                      </span>

                      {/* Lo que hace deja de ser una insignia y pasa a ser
                          contenido: una insignia dice en qué ESTADO está algo,
                          y esto es lo que el convenio hace, que es la columna
                          que más se lee. */}
                      <span role="cell" style={{ fontSize: "14px", minWidth: 0 }}>
                        {c.descripcion}
                        {porSello && (
                          <span style={{ display: "block", fontSize: "12px", color: "var(--texto-tenue)" }}>
                            con el sello del comercio
                          </span>
                        )}
                      </span>

                      {administra && (
                        <>
                          <span role="cell" style={{ ...cifra, textAlign: "right", fontSize: "14px" }}>
                            {porSello ? "—" : c.placas.length}
                          </span>
                          <span role="cell" style={{ ...cifra, textAlign: "right", fontSize: "14px" }}>
                            {suUso?.usos ?? 0}
                          </span>
                      {/* La cifra que convierte esto en una decisión de negocio
                          y no en un ajuste. Va destacada porque es la única que
                          cuesta dinero. */}
                      <span
                        role="cell"
                        style={{
                          ...cifra,
                          textAlign: "right",
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "var(--convenio-texto)",
                        }}
                      >
                        ${(suUso?.sinCobrar ?? 0).toLocaleString("es-CO")}
                          </span>
                        </>
                      )}
                      <span role="cell" style={{ ...cifra, fontSize: "13px", color: "var(--texto-tenue)" }}>
                        {c.hasta ? fecha(c.hasta) : "no vence"}
                      </span>

                      {administra && (
                      <span role="cell" style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          aria-expanded={abierto === c.id}
                          onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                          style={botonMenudo}
                        >
                          {abierto === c.id ? "Cerrar" : "Gestionar"}
                        </button>
                      </span>
                      )}
                    </div>

                    {administra && abierto === c.id && (
                      <div className="convenios-gestion">
                        {porSello ? (
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--texto-tenue)", maxWidth: "46em" }}>
                            Se activa con el sello del comercio, así que no lleva lista de placas:
                            sirve para cualquier cliente que llegue con el ticket sellado.
                          </p>
                        ) : (
                          <>
                            <div className="convenios-placas">
                              {c.placas.length === 0 ? (
                                <span style={{ fontSize: "13px", color: "var(--texto-tenue)" }}>
                                  Sin placas: todavía no cubre a nadie.
                                </span>
                              ) : (
                                c.placas.map((placa) => (
                                  <form key={placa} action={accion}>
                                    <input type="hidden" name="accion" value="quitar_placa" />
                                    <input type="hidden" name="convenioId" value={c.id} />
                                    <input type="hidden" name="placa" value={placa} />
                                    {/* El nombre accesible dice lo que hace.
                                        Antes era "ABC123 ✕", que para quien no
                                        ve la pantalla es una placa a secas, y
                                        pulsarla la borra. */}
                                    <button
                                      type="submit"
                                      aria-label={`Quitar la placa ${placa} de ${c.nombre}`}
                                      style={{ ...botonSecundario, ...cifra, fontSize: "13px" }}
                                    >
                                      {placa}
                                      <span aria-hidden="true" style={{ opacity: 0.55 }}>✕</span>
                                    </button>
                                  </form>
                                ))
                              )}
                            </div>

                            <form action={accion} className="convenios-agregar">
                              <input type="hidden" name="accion" value="agregar_placa" />
                              <input type="hidden" name="convenioId" value={c.id} />
                              <label style={{ display: "grid", gap: "6px" }}>
                                <span style={{ fontSize: "13px", fontWeight: 500 }}>Agregar una placa</span>
                                <input
                                  name="placa"
                                  placeholder="ABC123"
                                  required
                                  autoComplete="off"
                                  spellCheck={false}
                                  autoCapitalize="characters"
                                  style={{ ...campoTexto, ...cifra, width: "9rem", textTransform: "uppercase" }}
                                />
                              </label>
                              <button
                                type="submit"
                                disabled={enviando}
                                style={deshabilitado(botonSecundario, enviando)}
                              >
                                Agregar
                              </button>
                            </form>
                          </>
                        )}

                        <form action={accion} className="convenios-vencer">
                          <input type="hidden" name="accion" value="vencer" />
                          <input type="hidden" name="convenioId" value={c.id} />
                          <button
                            type="submit"
                            disabled={enviando}
                            onClick={(e) => {
                              if (!confirm("¿Vencer este convenio? Las placas dejan de tener descuento, pero el convenio se conserva para poder explicar cobros pasados.")) {
                                e.preventDefault();
                              }
                            }}
                            style={deshabilitado(botonPeligro, enviando)}
                          >
                            Vencer el convenio
                          </button>
                          <span style={{ fontSize: "12px", color: "var(--texto-tenue)", maxWidth: "34em" }}>
                            Deja de descontar desde ese momento. Se conserva, para poder explicar
                            los cobros que ya pasaron por él.
                          </span>
                        </form>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {administra && vencidos.length > 0 && (
        <>
          <h2 className="rotulo-filete" style={rotuloSeccion}>
            Vencidos ({vencidos.length})
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--texto-tenue)", maxWidth: "52em" }}>
            Ya no descuentan nada. Se conservan porque los cobros que pasaron por ellos tienen que
            poder explicarse.
          </p>
          {/* Sin `opacity` sobre el bloque entero: atenuar al 65% arrastra
              también al texto tenue, que ya estaba al límite de contraste, y
              lo deja por debajo. Lo que dice que están vencidos es que están
              en otra sección y que su texto va en tinta tenue, no que cueste
              leerlos. */}
          <ul
            className="filas"
            style={{ listStyle: "none", padding: 0, margin: "0 0 44px" }}
          >
            {vencidos.map((c) => (
              <li key={c.id}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "15px", color: "var(--texto-tenue)", fontWeight: 600 }}>
                    {c.nombre}
                  </strong>
                  <span style={{ fontSize: "13px", color: "var(--texto-tenue)" }}>
                    {c.descripcion}
                  </span>
                  <span style={{ ...cifra, marginLeft: "auto", fontSize: "12px", color: "var(--texto-tenue)" }}>
                    {c.hasta ? `hasta el ${fecha(c.hasta)}` : "retirado"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}


    </>
  );
}

/** Comprobar qué descuento tiene una placa, sin cobrar nada. */
export function Consulta() {
  const [estado, accion, enviando] = useActionState(consultarPlaca, {} as EstadoConsulta);
  const r = estado.resultado;

  return (
    <section style={{ marginBottom: "22px" }}>
      <h2 className="rotulo-filete" style={rotuloSeccion}>Comprobar una placa</h2>
      <form action={accion} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          name="placa"
          placeholder="ABC123"
          required
          style={{ ...campoTexto, ...cifra, width: "10rem", textTransform: "uppercase" }}
        />
        <button type="submit" disabled={enviando} style={deshabilitado(botonSecundario, enviando)}>
          {enviando ? "Consultando…" : "Consultar"}
        </button>
      </form>

      {estado.error && (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--error-texto)" }}>
          {estado.error}
        </p>
      )}

      {r && (
        <p
          role="status"
          style={{
            margin: "10px 0 0",
            padding: "10px 12px",
            borderRadius: "10px",
            fontSize: "14px",
            background: r.nombre ? "var(--convenio-fondo)" : "var(--superficie)",
            border: `1px solid ${r.nombre ? "var(--convenio-borde)" : "var(--borde)"}`,
            color: r.nombre ? "var(--convenio-texto)" : "var(--texto-tenue)",
          }}
        >
          <strong style={cifra}>{r.placa}</strong>{" "}
          {r.nombre
            ? `está en el convenio ${r.nombre} — ${r.descripcion}`
            : "no tiene ningún convenio vigente: se le cobra tarifa plena."}
        </p>
      )}
    </section>
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
