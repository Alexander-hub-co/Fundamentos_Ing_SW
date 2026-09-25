"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  confirmarCortesia,
  confirmarEntrada,
  confirmarSalida,
  consultarPlaca,
  type EstadoTaquilla,
} from "./acciones";
import { accionComprobanteEmitido } from "./acciones";
import { imprimirDocumento } from "./imprimir";
import { botonPrimario, botonSecundario, campoTexto, cifra, deshabilitado } from "@/app/ui";

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

const MOTIVO: Record<string, string> = {
  limite_diario: "ya se usó hoy",
  desplazado: "lo desplazó un cobro fijo",
};

/**
 * El campo único.
 *
 * ES la pantalla. Quien atiende escribe la placa y pulsa Enter; el sistema
 * decide si corresponde entrada o salida. No hay que elegir antes entre las dos,
 * y ésa es la decisión de diseño que se respeta aunque el resto cambie: cada
 * clic ahorrado se multiplica por cientos de vehículos al día y por cada
 * establecimiento.
 *
 * Va centrado y en letra grande de matrícula porque es lo único que el operario
 * mira mientras hay fila.
 */
export function CampoPlaca({
  confirmarCobro = false,
  imprimirAuto = false,
}: {
  confirmarCobro?: boolean;
  /** Con qué respuesta aparece marcada la pregunta de imprimir al salir. */
  imprimirAuto?: boolean;
}) {
  const [consulta, consultar, consultando] = useActionState(consultarPlaca, {} as EstadoTaquilla);
  const [entrada, entrar, entrando] = useActionState(confirmarEntrada, {} as EstadoTaquilla);
  const [salida, salir, saliendo] = useActionState(confirmarSalida, {} as EstadoTaquilla);
  const [cortesia, perdonar, perdonando] = useActionState(confirmarCortesia, {} as EstadoTaquilla);

  const [abrirCortesia, setAbrirCortesia] = useState(false);
  /**
   * Qué movimiento está esperando la confirmación de cobro.
   *
   * Se guarda el identificador y no un simple sí/no: así, cuando se consulta
   * otra placa, la confirmación pendiente se cae sola porque el movimiento ya
   * es otro. Con un booleano habría que acordarse de apagarlo, y el día que se
   * olvidara se cobraría de un clic la placa equivocada.
   */
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);

  /**
   * Si se imprime el recibo de ESTA salida.
   *
   * La decisión se toma con el cliente delante y no una vez en una pantalla de
   * ajustes: hay quien quiere su recibo y quien se va sin él, y el papel
   * térmico cuesta. Arranca en lo que diga el ajuste y el operario lo cambia
   * de un toque.
   */
  const [imprimirEstaSalida, setImprimirEstaSalida] = useState(imprimirAuto);
  const campo = useRef<HTMLInputElement>(null);

  const resolucion = consulta.resolucion;
  const hecho = entrada.ok ?? salida.ok ?? cortesia.ok;
  const falla = consulta.error ?? entrada.error ?? salida.error ?? cortesia.error;

  // El papel del último movimiento registrado, venga de una entrada, un cobro
  // o una cortesía.
  const papel = entrada.comprobante ?? salida.comprobante ?? cortesia.comprobante;
  const [imprimiendo, setImprimiendo] = useState(false);
  const [falloImpresion, setFalloImpresion] = useState<string | null>(null);
  // Qué movimiento ya se mandó solo, para no repetirlo en cada redibujado.
  const yaMandado = useRef<string | null>(null);

  const mandarAImprimir = async (html: string, movimientoId: string) => {
    setImprimiendo(true);
    setFalloImpresion(null);

    const resultado = await imprimirDocumento(html);

    if (resultado.ok) {
      // Se anota que salió, lo que lo saca de la lista de pendientes. Que el
      // navegador aceptara el trabajo no garantiza que el papel salga; por eso
      // se puede volver a imprimir desde esa misma lista.
      await accionComprobanteEmitido(movimientoId);
    } else {
      setFalloImpresion(resultado.motivo);
    }

    setImprimiendo(false);
  };

  useEffect(() => {
    if (!papel || !papel.automatico) return;
    if (yaMandado.current === papel.movimientoId) return;

    yaMandado.current = papel.movimientoId;
    void mandarAImprimir(papel.html, papel.movimientoId);
    // Sólo debe dispararse cuando cambia el movimiento, no cuando se redibuja
    // por cualquier otra razón: imprimir dos veces gasta papel y confunde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papel?.movimientoId, papel?.automatico]);

  /**
   * Sobre qué resolución ya se actuó.
   *
   * El resultado de la consulta y el de la confirmación son dos estados
   * separados, así que registrar la entrada NO borra la consulta que la
   * originó: quedaba abajo una tarjeta ofreciendo "Registrar entrada" para un
   * vehículo que ya estaba adentro, y pulsarla habría fallado contra el índice
   * de placa duplicada. Peor todavía, invitaba a pulsarla.
   *
   * Se guarda una CLAVE y no un simple sí/no porque la resolución tiene que
   * volver a aparecer en cuanto se consulte otra cosa —o la misma placa, que
   * entonces ya resuelve una salida—. Con un booleano habría que acordarse de
   * apagarlo, y el día que se olvidara la pantalla se quedaría muda.
   */
  const [actuado, setActuado] = useState<string | null>(null);

  const claveDe = (res: NonNullable<typeof resolucion>): string =>
    res.tipo === "entrada"
      ? `entrada:${res.placa}`
      : res.tipo === "salida"
        ? `salida:${res.movimiento.id}`
        : "rechazada";

  // Al confirmar: se marca la resolución como consumida y el campo queda vacío
  // y con el foco, listo para el vehículo siguiente. Quien atiende no debería
  // tener que borrar la placa anterior a mano con la fila esperando.
  useEffect(() => {
    if (!hecho || !resolucion) return;

    setActuado(claveDe(resolucion));
    if (campo.current) {
      campo.current.value = "";
      campo.current.focus();
    }
    // Se dispara con el mensaje de confirmación, que es lo que cambia cuando
    // una acción termina bien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hecho]);

  /**
   * La resolución VIGENTE: nada si ya se actuó sobre ella.
   *
   * Todo lo que pinta la pantalla mira esta y no la cruda, para que no haga
   * falta acordarse de comprobarlo en cada sitio.
   */
  const r = resolucion && claveDe(resolucion) !== actuado ? resolucion : null;

  // El estado que se muestra sobre la caja de la placa: es lo que le dice a
  // quien atiende, antes de leer nada más, si el vehículo entra o sale.
  // Qué convenios entraron en el cálculo que se está mostrando.
  const aplicados =
    r?.tipo === "salida" ? r.cobro.beneficios.filter((b) => !b.noAplicado) : [];
  const conConvenio = aplicados.length > 0;

  const estado =
    r?.tipo === "salida"
      ? conConvenio
        ? {
            // Azul y no verde: la maqueta reserva ese color para "hay un
            // acuerdo de por medio", que es lo que quien atiende necesita ver
            // antes de decir un precio en voz alta.
            texto: `Convenio · ${aplicados.map((b) => b.nombre).join(" + ")}`,
            color: "var(--convenio-borde)",
            sobre: "#fff",
          }
        : { texto: "Ya está adentro → salida", color: "var(--marca)", sobre: "var(--marca-sobre)" }
      : r?.tipo === "entrada"
        ? { texto: "No está adentro → entrada", color: "var(--marca)", sobre: "var(--marca-sobre)" }
        : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Taquilla</h1>
        <span style={{ fontSize: "13px", color: "var(--texto-tenue)" }}>
          el sistema detecta si la placa ya está adentro
        </span>
      </div>

      <form action={consultar} style={cajaPlaca}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "10px" }}>
          <label htmlFor="placa" style={rotuloGrande}>
            Placa
          </label>
          {estado && (
            <span style={{ ...insigniaEstado, background: estado.color, color: estado.sobre }}>
              {estado.texto}
            </span>
          )}
        </div>

        <input
          id="placa"
          className="campo-placa"
          ref={campo}
          name="placa"
          autoFocus
          autoComplete="off"
          placeholder="ABC123"
          aria-describedby="ayuda-placa"
          style={{
            ...campoDePlaca,
            // El recuadro se pone verde cuando el vehículo ya está adentro:
            // quien atiende lo ve sin leer.
            borderColor:
              r?.tipo === "salida"
                ? conConvenio
                  ? "var(--convenio-borde)"
                  : "var(--marca)"
                : "var(--borde-control)",
          }}
        />
        <p id="ayuda-placa" style={{ ...ayuda, textAlign: "center", marginTop: "9px" }}>
          {r?.tipo === "salida"
            ? "Enter cobra y cierra el movimiento"
            : "Escriba la placa y pulse Enter. El sistema reconoce si el vehículo entra o sale."}
        </p>
        <button
          type="submit"
          disabled={consultando}
          style={{ ...deshabilitado(botonSecundario, consultando), width: "100%", marginTop: "10px" }}
        >
          {consultando ? "Buscando…" : "Buscar placa"}
        </button>
      </form>

      {/* La confirmación del último movimiento, con su botón de imprimir. Se
          retira en cuanto hay una placa nueva en pantalla: o se está mirando lo
          que acaba de pasar, o se está atendiendo al siguiente, nunca las dos
          cosas a la vez. */}
      {hecho && !r && (
        <div style={aviso("ok")}>
          <p role="status" style={{ margin: 0 }}>
            {hecho}
          </p>

          {/* El botón está SIEMPRE, incluso con la impresión automática
              encendida: es lo que salva el ticket que no salió porque el papel
              se acabó, y no obliga a ir a buscar el movimiento a otra lista. */}
          {papel && (
            <button
              type="button"
              disabled={imprimiendo}
              onClick={() => void mandarAImprimir(papel.html, papel.movimientoId)}
              style={deshabilitado({ ...botonSecundario, marginTop: "9px" }, imprimiendo)}
            >
              {imprimiendo ? "Imprimiendo…" : "Imprimir ticket"}
            </button>
          )}
        </div>
      )}

      {falloImpresion && (
        <p role="alert" style={aviso("error")}>
          No se pudo imprimir: {falloImpresion}. El movimiento quedó registrado y el ticket
          aparece en la lista de pendientes.
        </p>
      )}
      {falla && (
        <p role="alert" style={aviso("error")}>
          {falla}
        </p>
      )}

      {r?.tipo === "rechazada" && (
        <p role="alert" style={aviso("error")}>
          {r.motivo}
        </p>
      )}

      {/* ── Entrada ───────────────────────────────────────────────────── */}
      {r?.tipo === "entrada" && (
        <form action={entrar} style={tarjeta}>
          <input type="hidden" name="placa" value={r.placa} />
          <p style={{ ...cifra, fontSize: "34px", fontWeight: 800, margin: 0, textAlign: "center" }}>
            {r.placa}
          </p>
          <p style={{ ...ayuda, textAlign: "center", margin: "2px 0 14px" }}>
            No está adentro · entra como {r.tipoNombre.toLowerCase()}
          </p>

          {/* El aviso de confirmación: qué se le va a cobrar. Si tiene convenio,
              se nombra el convenio en lugar del importe, porque es lo que quien
              atiende necesita decirle al cliente. */}
          <div style={r.convenio ? recuadroConvenio : recuadroTarifa}>
            {r.convenio ? (
              <>
                <strong>Convenio {r.convenio}</strong> — se aplicará al salir
              </>
            ) : r.sinTarifa ? (
              <strong>Sin tarifa declarada para {r.tipoNombre.toLowerCase()}: no se le va a poder cobrar al salir</strong>
            ) : (
              <>Tarifa: {r.tarifa}</>
            )}
          </div>

          <button
            type="submit"
            disabled={entrando}
            style={{ ...deshabilitado(botonPrimario, entrando), width: "100%", padding: "14px", marginTop: "14px" }}
          >
            {entrando ? "Registrando…" : "Registrar entrada"}
          </button>
        </form>
      )}

      {/* ── Salida ────────────────────────────────────────────────────── */}
      {r?.tipo === "salida" && (
        <>
          {conConvenio && (
            <div style={avisoConvenio}>
              <span style={insigniaConvenio}>C</span>
              <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                <strong style={{ fontSize: "14px" }}>
                  Convenio vigente: {aplicados.map((b) => b.nombre).join(", ")}
                </strong>
                <div style={{ color: "var(--convenio-texto)", marginTop: "2px" }}>
                  {r.cobro.minutosRegalados > 0
                    ? `No se cobran ${duracion(r.cobro.minutosRegalados)}. Se cobra únicamente el excedente, y el movimiento guarda copia del convenio aplicado.`
                    : "El descuento ya está aplicado abajo, y el movimiento guarda copia del convenio."}
                </div>
              </div>
            </div>
          )}

          {/* Con tiempo cubierto son TRES cifras y no dos, como en la maqueta:
              cuánto estuvo, cuánto le perdona el convenio y cuánto queda por
              cobrar. Separarlas es lo que permite explicarle el número al
              cliente sin hacer cuentas delante de él. */}
          <div style={r.cobro.minutosRegalados > 0 ? tresCifras : dosCifras}>
            <div style={tarjetaCifra}>
              <div style={rotuloCifra}>Permanencia</div>
              <div style={cifraGrande}>{duracion(r.minutosDentro)}</div>
              {/* El rótulo va acá y no sólo en el botón: con una bicicleta,
                  quien atiende escribió "1" y necesita ver confirmado que el
                  sistema entendió "Ficha 1". */}
              <div style={{ fontSize: "12px", color: "var(--texto-tenue)", marginTop: "2px" }}>
                {r.rotulo} · entró {hora(r.movimiento.entradaEn)} · {r.movimiento.codigo}
              </div>
            </div>

            {r.cobro.minutosRegalados > 0 && (
              <div style={{ ...tarjetaCifra, borderColor: "var(--convenio-borde)" }}>
                <div style={{ ...rotuloCifra, color: "var(--convenio-texto)" }}>Cubierto</div>
                <div style={{ ...cifraGrande, color: "var(--convenio-texto)" }}>
                  {duracion(r.cobro.minutosRegalados)}
                </div>
                <div style={{ fontSize: "12px", color: "var(--texto-tenue)", marginTop: "2px" }}>
                  por el convenio
                </div>
              </div>
            )}

            {/* El total en verde y con borde propio: es la cifra que quien
                atiende le va a decir al cliente en voz alta. */}
            <div style={{ ...tarjetaCifra, borderColor: "var(--marca)" }}>
              <div style={{ ...rotuloCifra, color: "var(--acento)" }}>Total a cobrar</div>
              <div style={{ ...cifraGrande, color: "var(--acento)" }}>{pesos(r.cobro.importe)}</div>
              <div style={{ fontSize: "12px", color: "var(--texto-tenue)", marginTop: "2px" }}>
                {r.cobro.minutosTotales} min cobrables
              </div>
            </div>
          </div>

          {/* Los sellos van en el formulario de CONSULTA y no en el de cobro,
              y marcan la diferencia entre un número correcto y uno mentiroso:
              al marcar uno se vuelve a calcular en el acto, así que lo que
              quien atiende lee en pantalla es lo que se va a cobrar. Antes
              había que buscar la placa otra vez para verlo, y nadie lo hacía. */}
          {r.sellos.length > 0 && (
            <form action={consultar}>
              <input type="hidden" name="placa" value={r.consulta} />
              <fieldset style={recuadroSellos}>
                <legend style={{ fontSize: "13px", fontWeight: 600, padding: "0 6px" }}>
                  ¿Trae sello?
                </legend>
                {r.sellos.map((sello) => (
                  <label
                    key={sello.id}
                    style={{ display: "flex", gap: "9px", alignItems: "baseline", padding: "3px 0" }}
                  >
                    <input
                      type="checkbox"
                      name="sello"
                      value={sello.id}
                      defaultChecked={r.sellosAplicados.includes(sello.id)}
                      disabled={consultando}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      style={{ accentColor: "var(--marca)" }}
                    />
                    <span style={{ fontSize: "15px" }}>
                      {sello.nombre}{" "}
                      <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>
                        {sello.descripcion}
                      </span>
                    </span>
                  </label>
                ))}
                <p style={{ ...ayuda, margin: "6px 0 0" }}>
                  {consultando ? "Recalculando…" : "El total de arriba ya incluye lo que marque."}
                </p>
              </fieldset>
            </form>
          )}

          <form action={salir} style={{ display: "contents" }}>
            <input type="hidden" name="movimientoId" value={r.movimiento.id} />
            {/* Los mismos que entraron en el cálculo que se está mostrando. */}
            {r.sellosAplicados.map((id) => (
              <input key={id} type="hidden" name="sello" value={id} />
            ))}

            {/* El desglose, siempre. Un total que quien atiende no puede
                explicarle al cliente es un problema en plena fila. */}
            <div style={desglose}>
              <div style={cabeceraDesglose}>Desglose</div>
              <div style={filaDesglose}>
                <span>Sin convenios · tarifa sola</span>
                <span style={cifra}>{pesos(r.cobro.importeBase)}</span>
              </div>
              {r.cobro.beneficios.map((b, i) => (
                <div key={i} style={{ ...filaDesglose, opacity: b.noAplicado ? 0.6 : 1 }}>
                  <span>
                    {b.nombre}
                    {b.noAplicado && (
                      <span style={{ color: "var(--texto-tenue)" }}>
                        {" "}— {MOTIVO[b.noAplicado] ?? b.noAplicado}
                      </span>
                    )}
                  </span>
                  <span style={cifra}>{b.noAplicado ? "—" : `−${pesos(b.descontado)}`}</span>
                </div>
              ))}
              {r.cobro.redondeo.restado > 0 && (
                <div style={filaDesglose}>
                  <span>Redondeo</span>
                  <span style={cifra}>−{pesos(r.cobro.redondeo.restado)}</span>
                </div>
              )}
            </div>

            {/* ¿Se imprime el recibo? Se pregunta acá, con el cliente delante,
                y viaja con el cobro. No es un ajuste: cambia de un cliente al
                siguiente. */}
            <input
              type="hidden"
              name="imprimirSalida"
              value={imprimirEstaSalida ? "si" : "no"}
            />
            <div style={preguntaImpresion}>
              <span style={{ fontSize: "14px", flex: 1, minWidth: "11rem" }}>
                ¿Imprimir ticket de salida?
              </span>
              <div style={{ display: "flex", gap: "7px" }}>
                <button
                  type="button"
                  aria-pressed={imprimirEstaSalida}
                  onClick={() => setImprimirEstaSalida(true)}
                  style={respuesta(imprimirEstaSalida)}
                >
                  Sí
                </button>
                <button
                  type="button"
                  aria-pressed={!imprimirEstaSalida}
                  onClick={() => setImprimirEstaSalida(false)}
                  style={respuesta(!imprimirEstaSalida)}
                >
                  No
                </button>
              </div>
            </div>

            {/* El paso de confirmación es opcional y se activa en Ajustes.
                Quien atiende fila alta suele preferirlo apagado; quien cobra
                poco y no quiere equivocarse, encendido. */}
            {confirmarCobro && porConfirmar === r.movimiento.id ? (
              <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={saliendo}
                  style={{
                    ...deshabilitado(botonPrimario, saliendo),
                    flex: 1,
                    minWidth: "14rem",
                    padding: "14px",
                    fontSize: "16px",
                  }}
                >
                  {saliendo
                    ? "Cobrando…"
                    : `Sí, cobrar ${pesos(r.cobro.importe)} a ${r.rotulo}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPorConfirmar(null)}
                  style={{ ...botonSecundario, padding: "14px 18px" }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type={confirmarCobro ? "button" : "submit"}
                  disabled={saliendo}
                  onClick={
                    confirmarCobro ? () => setPorConfirmar(r.movimiento.id) : undefined
                  }
                  style={{
                    ...deshabilitado(botonPrimario, saliendo),
                    flex: 1,
                    minWidth: "14rem",
                    padding: "14px",
                    fontSize: "16px",
                  }}
                >
                  {saliendo ? "Cobrando…" : `Cobrar ${pesos(r.cobro.importe)}`}
                </button>
                {!abrirCortesia && (
                  <button
                    type="button"
                    onClick={() => setAbrirCortesia(true)}
                    style={{ ...botonSecundario, padding: "14px 18px" }}
                  >
                    Salir sin cobrar
                  </button>
                )}
              </div>
            )}
          </form>

          {/* La cortesía va detrás de un paso más: no es lo que se hace
              normalmente, y tenerla a un clic invitaría a usarla por comodidad. */}
          {abrirCortesia && (
            <form action={perdonar} style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
              <input type="hidden" name="movimientoId" value={r.movimiento.id} />
              <input
                type="hidden"
                name="imprimirSalida"
                value={imprimirEstaSalida ? "si" : "no"}
              />
              <input
                name="motivo"
                required
                placeholder="Por qué no se cobra"
                style={{ ...campoTexto, flex: 1, minWidth: "14rem" }}
              />
              <button type="submit" disabled={perdonando} style={deshabilitado(botonSecundario, perdonando)}>
                Confirmar sin cobro
              </button>
              <button type="button" onClick={() => setAbrirCortesia(false)} style={botonSecundario}>
                Cancelar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

const hora = (d: Date) =>
  new Date(d).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const rotuloGrande: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
  textAlign: "center",
};

/**
 * Grande, centrado y en monoespaciada: es lo único que se mira con fila.
 *
 * 64px de partida y no menos. La maqueta lo pone así por una razón operativa:
 * quien atiende está de pie, mirando de reojo entre el carro y la pantalla, y
 * tiene que poder confirmar la placa de un vistazo sin acercarse. En Ajustes se
 * puede subir todavía más, para casetas con la pantalla lejos o con poca luz;
 * el alto de la caja sigue al texto para que la proporción se mantenga.
 */
/** La pregunta de imprimir, en el mismo renglón que su respuesta. */
const preguntaImpresion: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
  padding: "10px 14px",
  borderRadius: "10px",
  background: "var(--fondo)",
};

/**
 * Sí y No.
 *
 * La elegida lleva relleno y la otra recuadro: las dos se distinguen de un
 * texto suelto, que es lo que exige la regla de los botones.
 */
function respuesta(elegida: boolean): React.CSSProperties {
  return {
    ...botonSecundario,
    minWidth: "3.5rem",
    fontWeight: elegida ? 700 : 500,
    background: elegida ? "var(--boton-fondo)" : "var(--fondo)",
    color: elegida ? "var(--boton-texto)" : "var(--texto)",
    borderColor: elegida ? "transparent" : "var(--borde-control)",
  };
}

const campoDePlaca: React.CSSProperties = {
  fontFamily: "var(--fuente-mono), ui-monospace, monospace",
  fontSize: "var(--placa-tamano, 64px)",
  fontWeight: 800,
  letterSpacing: "0.07em",
  textAlign: "center",
  textTransform: "uppercase",
  height: "calc(var(--placa-tamano, 64px) + 40px)",
  padding: "0 12px",
  borderRadius: "10px",
  border: "2px solid var(--borde-control)",
  // Más oscuro que la tarjeta que lo contiene: la caja de la placa se hunde,
  // como en la maqueta, en vez de flotar.
  background: "var(--fondo)",
  color: "var(--texto)",
  width: "100%",
};

/**
 * El bloque de la placa. Sin caja.
 *
 * Era un recuadro dentro de otro recuadro: el campo ya tiene su propio
 * contorno grueso —que ahí sí significa algo, porque es EL control de la
 * pantalla— y meterlo además en una tarjeta lo enterraba un nivel más.
 */
const cajaPlaca: React.CSSProperties = {
  marginTop: "20px",
  padding: "20px",
};

const insigniaEstado: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "3px 9px",
  borderRadius: "999px",
  whiteSpace: "nowrap",
};

/** Las dos cifras que quien atiende necesita: cuánto lleva y cuánto debe. */
const dosCifras: React.CSSProperties = {
  marginTop: "18px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
  gap: "12px",
};

const tresCifras: React.CSSProperties = {
  ...dosCifras,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9rem), 1fr))",
};

const avisoConvenio: React.CSSProperties = {
  marginTop: "16px",
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  padding: "14px 16px",
  borderRadius: "12px",
  background: "var(--convenio-fondo)",
  border: "1px solid var(--convenio-borde)",
};

const insigniaConvenio: React.CSSProperties = {
  width: "26px",
  height: "26px",
  flex: "none",
  borderRadius: "50%",
  background: "var(--convenio-borde)",
  display: "grid",
  placeItems: "center",
  fontSize: "14px",
  fontWeight: 800,
  color: "#fff",
};

/**
 * Una cifra del cobro. Sin relleno.
 *
 * Tres rellenos iguales al lado de la placa competían con ella, que es lo único
 * que quien atiende mira con fila. Ahora lo que las separa es un filete
 * vertical y el aire, y la jerarquía vuelve a estar donde debe.
 */
const tarjetaCifra: React.CSSProperties = {
  padding: "2px 18px 2px 0",
  borderRight: "1px solid var(--borde)",
};

const cifraGrande: React.CSSProperties = {
  fontFamily: "var(--fuente-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  fontSize: "30px",
  fontWeight: 800,
  lineHeight: 1.15,
  marginTop: "4px",
};

const rotuloCifra: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
};

const tarjeta: React.CSSProperties = {
  padding: "22px 0 0",
  marginTop: "18px",
};

const recuadroTarifa: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid var(--borde-control)",
  fontSize: "15px",
  textAlign: "center",
};

const recuadroConvenio: React.CSSProperties = {
  ...recuadroTarifa,
  background: "var(--convenio-fondo)",
  borderColor: "var(--convenio-borde)",
  color: "var(--convenio-texto)",
};

/** Los sellos: un filete que los separa, no un recuadro que los encierra. */
const recuadroSellos: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--borde)",
  padding: "16px 0 0",
  margin: "18px 0 0",
};

const desglose: React.CSSProperties = {
  marginTop: "22px",
};

const cabeceraDesglose: React.CSSProperties = {
  padding: "0 0 8px",
  borderBottom: "1px solid var(--borde-control)",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
};

const filaDesglose: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  padding: "9px 0",
  fontSize: "13px",
  borderTop: "1px solid var(--borde)",
};

const ayuda: React.CSSProperties = { fontSize: "13px", color: "var(--texto-tenue)", margin: 0 };

function aviso(tipo: "ok" | "error"): React.CSSProperties {
  return {
    margin: "14px 0 0",
    padding: "12px 14px",
    borderRadius: "10px",
    fontSize: "15px",
    textAlign: "center",
    color: tipo === "error" ? "var(--error-texto)" : "var(--marca-texto)",
    background: tipo === "error" ? "var(--error-fondo)" : "transparent",
    border: `1px solid ${tipo === "error" ? "var(--error-borde)" : "var(--borde-control)"}`,
  };
}
