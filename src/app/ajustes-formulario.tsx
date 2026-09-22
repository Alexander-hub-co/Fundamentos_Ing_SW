"use client";

import { useActionState, useState } from "react";
import type { CSSProperties } from "react";
import { guardarAjustes, type EstadoAjustes } from "./ajustes-acciones";
import { botonPrimario, botonSecundario, cifra, deshabilitado, rotuloSeccion } from "./ui";
import type { Preferencias } from "@/dominio/preferencias/valores";
import { ANCHOS_ROLLO, PLACA_MAXIMA, PLACA_MINIMA, PREFERENCIAS_POR_DEFECTO } from "@/dominio/preferencias/valores";

/**
 * Ajustes de apariencia y de taquilla (maqueta 8d).
 *
 * Un solo formulario con un solo "Guardar", como dibuja la maqueta. Es lo
 * correcto acá: son cinco decisiones de la misma naturaleza, y guardarlas por
 * separado obligaría a cinco confirmaciones para una sola sesión de ajuste.
 *
 * Todo el estado vive en el cliente para que la elección se vea al instante
 * —la miniatura que se enciende, los píxeles que suben— sin ir al servidor. Lo
 * que se ve seleccionado es exactamente lo que se va a enviar.
 */
export function FormularioAjustes({
  inicial,
  soloApariencia = false,
}: {
  inicial: Preferencias;
  /**
   * La plataforma no tiene taquilla, así que allá los tres bloques que la
   * ajustan no se dibujan. Los valores siguen viajando en los campos ocultos:
   * si esa cuenta llega a atender una taquilla, los encuentra puestos en vez de
   * en blanco.
   */
  soloApariencia?: boolean;
}) {
  const [estado, accion, enviando] = useActionState(guardarAjustes, {} as EstadoAjustes);

  const [tema, setTema] = useState(inicial.tema);
  // Sigue viajando aunque ya no se elija: la preferencia existe en la base y
  // la acción la valida. El día que la paleta vuelva a tener más de un color
  // de marca, el selector regresa sin migración.
  const [acento] = useState(inicial.acento);
  const [densidad, setDensidad] = useState(inicial.densidad);
  const [tamanoPlaca, setTamanoPlaca] = useState(inicial.tamanoPlaca);
  const [confirmarCobro, setConfirmarCobro] = useState(inicial.confirmarCobro);
  const [imprimirAuto, setImprimirAuto] = useState(inicial.imprimirAuto);
  const [anchoRollo, setAnchoRollo] = useState(inicial.anchoRollo);

  return (
    <form action={accion} className="ficha-columnas ajustes-columnas">
      <input type="hidden" name="tema" value={tema} />
      <input type="hidden" name="acento" value={acento} />
      <input type="hidden" name="densidad" value={densidad} />
      <input type="hidden" name="tamanoPlaca" value={tamanoPlaca} />
      {confirmarCobro && <input type="hidden" name="confirmarCobro" value="si" />}
      {imprimirAuto && <input type="hidden" name="imprimirAuto" value="si" />}
      <input type="hidden" name="anchoRollo" value={anchoRollo} />

      <div className="pila">
        <fieldset style={grupo}>
          <legend className="rotulo-filete" style={{ ...rotuloSeccion, width: "100%" }}>
            Tema
          </legend>
          <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
            {TEMAS.map((opcion) => (
              <MiniaturaTema
                key={opcion.valor}
                {...opcion}
                elegido={tema === opcion.valor}
                onElegir={() => setTema(opcion.valor)}
              />
            ))}
          </div>
          <p style={nota}>
            No se consulta la preferencia del sistema operativo: la elección es explícita y se
            recuerda.
          </p>
        </fieldset>

        {!soloApariencia && (
        <fieldset style={grupo}>
          <legend className="rotulo-filete" style={{ ...rotuloSeccion, width: "100%" }}>
            Densidad de la taquilla
          </legend>
          <div className="segmentado" style={{ marginTop: "16px" }}>
            {DENSIDADES.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={densidad === opcion.valor}
                onClick={() => setDensidad(opcion.valor)}
              >
                {opcion.titulo}
              </button>
            ))}
          </div>
          <p style={nota}>
            Densa muestra la lista de adentro junto al campo de placa; cómoda deja sólo la placa.
          </p>
        </fieldset>
        )}

        {!soloApariencia && (
        <fieldset style={grupo}>
          <legend className="rotulo-filete" style={{ ...rotuloSeccion, width: "100%" }}>
            Tamaño de la placa
          </legend>
          {/* La muestra vale más que el número: 72 px no dice nada hasta que se
              ve una placa de 72 px. Va sin recuadro, sobre el fondo de la
              pantalla, que es donde de verdad se va a leer. */}
          <div style={muestraPlaca(tamanoPlaca)}>ABC·123</div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "4px" }}>
            <input
              type="range"
              min={PLACA_MINIMA}
              max={PLACA_MAXIMA}
              step={4}
              value={tamanoPlaca}
              onChange={(e) => setTamanoPlaca(Number(e.target.value))}
              aria-label="Tamaño de la placa en píxeles"
              style={{ flex: 1, accentColor: "var(--marca)", minWidth: 0 }}
            />
            <span
              style={{
                ...cifra,
                fontSize: "13px",
                fontWeight: 700,
                minWidth: "52px",
                textAlign: "right",
                color: "var(--texto-tenue)",
              }}
            >
              {tamanoPlaca} px
            </span>
          </div>
          <p style={nota}>Para pantallas lejanas o poca luz en la caseta.</p>
        </fieldset>
        )}
      </div>

      <div className="pila">

        {!soloApariencia && (
        <>
        <fieldset style={grupo}>
          <legend className="rotulo-filete" style={{ ...rotuloSeccion, width: "100%" }}>
            Preferencias de la taquilla
          </legend>
          <div className="filas" style={{ marginTop: "12px" }}>
            <Interruptor
              titulo="Imprimir ticket automáticamente"
              detalle="al registrar entrada y al cobrar"
              activo={imprimirAuto}
              onCambiar={() => setImprimirAuto((v: boolean) => !v)}
            />
            <Interruptor
              titulo="Confirmar antes de cobrar"
              detalle="un paso más, menos cobros por error"
              activo={confirmarCobro}
              onCambiar={() => setConfirmarCobro((v) => !v)}
            />
          </div>
          <p style={nota}>
            Con la impresión automática apagada el ticket sigue estando: sale un botón para
            imprimirlo. Los que no salieron quedan listados en la taquilla. Al cobrar una
            salida se pregunta aparte, con el cliente delante.
          </p>
          {/* La maqueta dibuja acá una tercera casilla, "sonido al detectar
              convenio", que todavía no controla nada porque no hay capa de
              sonido. Un interruptor que no hace nada es peor que su ausencia,
              así que se deja para cuando exista lo que enciende. */}
        </fieldset>

        <fieldset style={grupo}>
          <legend className="rotulo-filete" style={{ ...rotuloSeccion, width: "100%" }}>
            Ancho del rollo
          </legend>
          <div className="segmentado" style={{ marginTop: "16px" }}>
            {ANCHOS_ROLLO.map((ancho) => (
              <button
                key={ancho}
                type="button"
                aria-pressed={anchoRollo === ancho}
                onClick={() => setAnchoRollo(ancho)}
              >
                {ancho} mm
              </button>
            ))}
          </div>
          <p style={nota}>
            El de la impresora térmica de esta caseta. Si el ticket sale recortado a los lados o
            deja un margen ancho, es esto.
          </p>
        </fieldset>
        </>
        )}

        {/* Sin recuadro y sin filete de color al lado: sólo el texto, en el
            color que le corresponde. */}
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

        <div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={enviando}
              style={deshabilitado({ ...botonPrimario, flex: 1, padding: "13px", fontSize: "15px" }, enviando)}
            >
              {enviando ? "Guardando…" : "Guardar ajustes"}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => {
                setTema(PREFERENCIAS_POR_DEFECTO.tema);
                setDensidad(PREFERENCIAS_POR_DEFECTO.densidad);
                setTamanoPlaca(PREFERENCIAS_POR_DEFECTO.tamanoPlaca);
                setConfirmarCobro(PREFERENCIAS_POR_DEFECTO.confirmarCobro);
                setImprimirAuto(PREFERENCIAS_POR_DEFECTO.imprimirAuto);
                setAnchoRollo(PREFERENCIAS_POR_DEFECTO.anchoRollo);
              }}
              style={deshabilitado({ ...botonSecundario, padding: "13px 18px", fontSize: "14px" }, enviando)}
            >
              Restablecer
            </button>
          </div>
          {/* "Restablecer" sólo repone los valores en pantalla; sigue haciendo
              falta guardar. Así un clic accidental no borra la configuración. */}
          <p style={nota}>
            Restablecer repone los valores de fábrica en pantalla; para dejarlos, guardar.
          </p>
        </div>
      </div>
    </form>
  );
}

/**
 * Los colores de cada tema, escritos.
 *
 * Van literales y no como `var(--fondo)` porque una miniatura muestra el tema
 * que NO está puesto; con variables las dos se verían iguales. La contrapartida
 * es que hay que actualizarlos cuando cambia la paleta —esta lista se quedó
 * una vez con los colores de la paleta anterior, y la miniatura mostraba una
 * aplicación que ya no existía.
 */
const TEMAS = [
  {
    valor: "claro" as const,
    titulo: "Claro",
    fondo: "#ffffff",
    superficie: "#f3f5fa",
    borde: "#dde2ec",
    texto: "#0b0e15",
    tenue: "#767f94",
    marca: "#3a5dbe",
  },
  {
    valor: "oscuro" as const,
    titulo: "Oscuro",
    fondo: "#08080b",
    superficie: "#12141a",
    borde: "#23262f",
    texto: "#f2f4f8",
    tenue: "#5b6880",
    marca: "#7fa0e4",
  },
];

const DENSIDADES = [
  { valor: "densa" as const, titulo: "Densa" },
  { valor: "comoda" as const, titulo: "Cómoda" },
];

type Tema = (typeof TEMAS)[number];

/**
 * Vista previa de un tema: la aplicación dibujada en pequeño.
 *
 * Riel a la izquierda, título, dos renglones y un botón de marca. Se reconoce
 * como Parquivo, así que la elección se hace mirando lo que se va a ver y no
 * descifrando tres barras de colores.
 */
function MiniaturaTema({
  titulo,
  fondo,
  superficie,
  borde,
  texto,
  tenue,
  marca,
  elegido,
  onElegir,
}: Omit<Tema, "valor"> & { elegido: boolean; onElegir: () => void }) {
  return (
    <button type="button" className="tema-opcion" aria-pressed={elegido} onClick={onElegir}>
      <span className="tema-lienzo" style={{ background: fondo, borderColor: borde }}>
        <span style={riel(superficie, borde)}>
          <span style={{ ...trazo(marca), width: "60%", height: "5px" }} />
          <span style={{ ...trazo(tenue), width: "80%" }} />
          <span style={{ ...trazo(tenue), width: "65%" }} />
          <span style={{ ...trazo(tenue), width: "72%" }} />
        </span>
        <span style={cuerpo}>
          <span style={{ ...trazo(texto), width: "52%", height: "8px" }} />
          <span style={{ ...trazo(borde), width: "100%", height: "1px", borderRadius: 0 }} />
          <span style={{ ...trazo(tenue), width: "84%" }} />
          <span style={{ ...trazo(tenue), width: "68%" }} />
          <span style={{ ...trazo(marca), width: "38%", height: "12px", marginTop: "auto" }} />
        </span>
      </span>
      <span className="tema-pie">
        <span style={marcaElegido(elegido)} />
        {titulo}
      </span>
    </button>
  );
}

const riel = (superficie: string, borde: string): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "30%",
  padding: "10px 8px",
  background: superficie,
  borderRight: `1px solid ${borde}`,
});

const cuerpo: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
  flex: 1,
  padding: "10px 11px",
};

const trazo = (color: string): CSSProperties => ({
  height: "4px",
  borderRadius: "999px",
  background: color,
  opacity: 0.85,
});

/** El punto que dice cuál está elegido: relleno si sí, sólo contorno si no. */
const marcaElegido = (elegido: boolean): CSSProperties => ({
  width: "9px",
  height: "9px",
  borderRadius: "50%",
  flex: "none",
  background: elegido ? "var(--marca)" : "transparent",
  border: `1px solid ${elegido ? "var(--marca)" : "var(--borde-control)"}`,
});

function Interruptor({
  titulo,
  detalle,
  activo,
  onCambiar,
}: {
  titulo: string;
  detalle: string;
  activo: boolean;
  onCambiar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={onCambiar}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        padding: 0,
        textAlign: "left",
        font: "inherit",
        color: "var(--texto)",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span style={{ flex: 1, fontSize: "14px" }}>
        {titulo}
        <span style={{ display: "block", fontSize: "12px", color: "var(--texto-tenue)" }}>
          {detalle}
        </span>
      </span>
      <span
        style={{
          width: "42px",
          height: "24px",
          flex: "none",
          borderRadius: "999px",
          background: activo ? "var(--marca)" : "transparent",
          border: `1px solid ${activo ? "var(--marca)" : "var(--borde-control)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: activo ? "flex-end" : "flex-start",
          padding: "3px",
          transition: "background-color var(--rapido) var(--entra)",
        }}
      >
        <span
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: activo ? "var(--marca-sobre)" : "var(--texto-tenue)",
          }}
        />
      </span>
    </button>
  );
}

const grupo: CSSProperties = { border: "none", margin: 0, padding: 0, minWidth: 0 };

const nota: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "12px",
  color: "var(--texto-tenue)",
  lineHeight: 1.5,
};

/**
 * La placa de muestra, sin recuadro.
 *
 * Antes iba dentro de un marco de dos píxeles, que era justamente una caja de
 * más: en la taquilla la placa se lee sobre el fondo, no dentro de un cuadro.
 * Queda un filete abajo, que hace de base para que el número no flote.
 */
function muestraPlaca(tamano: number): CSSProperties {
  return {
    ...cifra,
    margin: "18px 0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: `${tamano + 34}px`,
    fontSize: `${tamano}px`,
    fontWeight: 800,
    letterSpacing: "0.07em",
    lineHeight: 1,
    color: "var(--texto)",
    borderBottom: "1px solid var(--borde)",
    overflow: "hidden",
  };
}

function aviso(tipo: "error" | "ok"): CSSProperties {
  return {
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: tipo === "error" ? "var(--error-texto)" : "var(--marca-texto)",
  };
}
