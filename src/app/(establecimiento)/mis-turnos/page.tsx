import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { botonMenudo, botonSecundario, cifra, rotuloSeccion, textoTenue, tituloPantalla } from "@/app/ui";
import { ArmazonEstablecimiento } from "../nav";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { misTurnosPasados, miTurnoAbierto } from "@/dominio/reportes/turnos";
import type { TurnoAbierto, TurnoPasado } from "@/dominio/reportes/turnos";

export const metadata = { title: "Mis turnos" };

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

const abreviado = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2).replace(".", ",")}M`
    : n >= 1_000
      ? `$${Math.round(n / 1_000)}k`
      : `$${n}`;

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

const fechaCorta = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);

const relojDeHoy = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
  }).format(d);

function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Mis turnos (maqueta 5a, donde se llamaba "Mis reportes").
 *
 * Responde una pregunta distinta de la de Reportes: no "cómo va el negocio"
 * sino **"cómo me fue en mi turno"**. Por eso el eje no es el calendario sino
 * la sesión, y las cifras son las que hacen falta para cuadrar la caja y
 * entregarla.
 *
 * Siempre acotada a la propia cuenta, incluso para un administrador: son SUS
 * turnos. Para ver los de todos está Reportes.
 *
 * **La pantalla tiene dos estados y no son el mismo con una parte apagada.**
 * Con turno abierto el sujeto es el turno y el histórico lo acompaña; sin
 * turno abierto el sujeto es el histórico y ocupa todo. Un primer intento las
 * metió a las dos en la misma rejilla de dos columnas, y sin turno abierto la
 * tabla quedaba estrujada en el 60% de la pantalla con la otra mitad en
 * blanco. La rejilla vive ahora DENTRO del bloque del turno, donde sus dos
 * columnas existen siempre.
 */
export default async function MisTurnos() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado === "dado_de_baja") redirect("/restringido");

  const ahora = new Date();
  const [abierto, pasados] = await Promise.all([
    miTurnoAbierto(contexto, ahora),
    misTurnosPasados(contexto),
  ]);

  return (
    <ArmazonEstablecimiento>
      <header className="cabecera-pantalla">
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...tituloPantalla, margin: 0 }}>Mis turnos</h1>
          <p style={{ ...textoTenue, margin: "10px 0 0" }}>
            Sólo sus propios turnos y movimientos.
          </p>
        </div>
        <span style={{ ...cifra, fontSize: "13px", color: "var(--texto-tenue)" }}>
          {relojDeHoy(ahora)} · {hhmm(ahora)}
        </span>
      </header>

      {abierto ? <TurnoEnCurso turno={abierto} ahora={ahora} /> : <SinTurno />}

      <Historico pasados={pasados} />
    </ArmazonEstablecimiento>
  );
}

/**
 * El turno que está corriendo ahora.
 *
 * Sin recuadro: el punto que late y el color de marca en su nombre dicen que
 * está vivo. Debajo, un filete lo separa del histórico.
 */
function TurnoEnCurso({ turno, ahora }: { turno: TurnoAbierto; ahora: Date }) {
  const llevan = duracion(Math.floor((ahora.getTime() - turno.abiertaEn.getTime()) / 60_000));

  return (
    <section style={{ marginBottom: "44px", paddingBottom: "38px", borderBottom: "1px solid var(--borde)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span className="punto-vivo" />
        <span style={{ ...rotuloSeccion, margin: 0, color: "var(--marca-texto)" }}>
          Turno abierto · {turno.nombre}
        </span>
        <span style={{ ...cifra, fontSize: "12px", color: "var(--texto-tenue)" }}>
          abrió {hhmm(turno.abiertaEn)} · programado {turno.programadaInicio.slice(0, 5)} · llevan{" "}
          {llevan}
        </span>
        <Link href="/taquilla" style={{ ...botonMenudo, marginLeft: "auto" }}>
          Ir a cerrarlo
        </Link>
      </div>

      <div className="turno-cifras">
        <Cifra
          rotulo="Vendido en el turno"
          valor={pesos(turno.metrica.vendido)}
          pie={`${turno.metrica.cobros} ${turno.metrica.cobros === 1 ? "cobro" : "cobros"}`}
          destacada
        />
        <Cifra
          rotulo="Movimientos"
          valor={String(turno.metrica.entradas + turno.metrica.cobros)}
          pie={`${turno.metrica.entradas} entradas · ${turno.metrica.cobros} salidas`}
        />
        <Cifra
          rotulo="Ticket promedio"
          valor={turno.metrica.ticketPromedio === null ? "—" : pesos(turno.metrica.ticketPromedio)}
          pie={`${turno.metrica.enPlena} ${turno.metrica.enPlena === 1 ? "cobro topó" : "cobros toparon"} la plena`}
        />
        <Cifra
          rotulo="Salidas sin cobro"
          valor={String(turno.metrica.sinCobro)}
          pie={`${pesos(turno.metrica.sinCobroImporte)} no cobrados`}
        />
      </div>

      {/* La franja de ventas por hora que la maqueta dibuja al pie del turno.
          El dato ya lo traía la consulta y la pantalla no lo estaba usando. */}
      {turno.porHora.length > 0 && <VentasPorHora datos={turno.porHora} />}

      {/* Las dos listas cortas van lado a lado, y la rejilla vive acá dentro:
          las dos existen siempre que exista el turno, así que nunca queda una
          columna vacía. */}
      <div className="turno-detalle">
        <section>
          <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "6px" }}>
            Entrega del turno
          </h2>
          <div className="filas">
            <Pendiente texto="Vehículos que quedan adentro" valor={turno.pendientes.adentro} />
            <Pendiente
              texto="Entradas que abrí y siguen abiertas"
              valor={turno.pendientes.miasAbiertas}
            />
            <Pendiente
              texto="Salidas que cerré de otro turno"
              valor={turno.pendientes.cerradasDeOtroTurno}
            />
          </div>
          <p style={{ ...textoTenue, marginTop: "12px", fontSize: "12px" }}>
            Una entrada y su salida pueden ser de turnos distintos: cada movimiento guarda quién
            hizo cada extremo, así que su venta cuenta sólo lo que usted cobró.
          </p>
        </section>

        <section>
          <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "14px" }}>
            Vendido por tipo
          </h2>
          {turno.porTipo.length > 0 ? (
            <PorTipo datos={turno.porTipo} />
          ) : (
            <p style={{ ...textoTenue, margin: 0, fontSize: "13px" }}>
              Todavía no ha cobrado ninguna salida en este turno.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

/**
 * Cuando no hay turno abierto.
 *
 * No es un error ni un hueco: es el estado normal de quien acaba de entregar.
 * Por eso lleva la salida a mano en vez de una frase gris suelta.
 */
function SinTurno() {
  return (
    <section style={{ marginBottom: "44px", paddingBottom: "38px", borderBottom: "1px solid var(--borde)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span className="punto-apagado" />
        <span style={{ ...rotuloSeccion, margin: 0 }}>Sin turno abierto</span>
      </div>
      <p style={{ ...textoTenue, margin: "14px 0 0", maxWidth: "42em" }}>
        El turno se abre desde la taquilla. A partir de ahí, todo lo que cobre queda contado en
        esta pantalla y se puede entregar cuadrado.
      </p>
      <Link href="/taquilla" style={{ ...botonSecundario, display: "inline-block", marginTop: "18px" }}>
        Ir a la taquilla
      </Link>
    </section>
  );
}

/**
 * Los turnos ya cerrados, a todo el ancho.
 *
 * Cada uno lleva su barra bajo el importe. Es lo que convierte una lista de
 * cifras en una comparación: la pregunta real al terminar no es "cuánto
 * vendí" sino "cuánto vendí COMPARADO con mis otros turnos".
 */
function Historico({ pasados }: { pasados: TurnoPasado[] }) {
  const totales = pasados.reduce(
    (t, p) => ({
      vendido: t.vendido + p.vendido,
      cobros: t.cobros + p.cobros,
      sinCobro: t.sinCobro + p.sinCobro,
    }),
    { vendido: 0, cobros: 0, sinCobro: 0 },
  );
  const maximo = Math.max(...pasados.map((p) => p.vendido), 1);

  return (
    <section>
      <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "10px" }}>
        Mis turnos anteriores
        {pasados.length > 0 && (
          <span style={{ ...contador, marginLeft: "12px" }}>últimos {pasados.length}</span>
        )}
      </h2>

      {pasados.length === 0 ? (
        <p style={{ ...textoTenue, margin: 0, maxWidth: "42em" }}>
          Todavía no ha cerrado ningún turno. Cuando cierre el primero aparecerá acá, con lo que
          vendió, para poder compararlo con los siguientes.
        </p>
      ) : (
        <div className="tabla-desliza">
          <div className="turnos-tabla">
            <div className="cabecera-tabla turnos-rejilla">
              <span>Fecha</span>
              <span>Turno</span>
              <span style={{ whiteSpace: "nowrap" }}>Real / programado</span>
              <span style={{ textAlign: "right" }}>Cobros</span>
              <span style={{ textAlign: "right" }}>Sin cobro</span>
              <span style={{ textAlign: "right" }}>Vendido</span>
            </div>

            <div className="filas filas-vivas">
              {pasados.map((p) => (
                <div key={p.sesionId} className="turnos-rejilla" style={{ fontSize: "13px" }}>
                  <span style={{ fontWeight: 600 }}>{fechaCorta(p.abiertaEn)}</span>
                  <span style={{ color: "var(--texto-tenue)" }}>{p.nombre}</span>
                  {/* Real y programado juntos: la diferencia entre los dos es
                      el dato, no cada uno por su lado. */}
                  <span style={{ ...cifra, color: "var(--texto-tenue)", whiteSpace: "nowrap" }}>
                    {hhmm(p.abiertaEn)}–{hhmm(p.cerradaEn)}{" "}
                    <span style={{ opacity: 0.65 }}>({p.programadaInicio.slice(0, 5)})</span>
                  </span>
                  <span style={{ textAlign: "right", ...cifra }}>{p.cobros}</span>
                  <span style={{ textAlign: "right", ...cifra, color: "var(--texto-tenue)" }}>
                    {p.sinCobro === 0 ? "—" : p.sinCobro}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <span style={{ ...cifra, fontWeight: 600 }}>{pesos(p.vendido)}</span>
                    {p.vendido > 0 && (
                      <span
                        className={p.vendido === maximo ? "turno-barra turno-barra-alta" : "turno-barra"}
                        style={{ width: `${Math.max(6, (p.vendido / maximo) * 100)}%` }}
                      />
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* El total sólo tiene sentido si hay algo que sumar. Con un turno
                solo repetiría su propia fila una línea más abajo. */}
            {pasados.length > 1 && (
              <div className="turnos-rejilla turnos-total">
                <span style={{ gridColumn: "span 3" }}>Total de {pasados.length} turnos</span>
                <span style={{ textAlign: "right", ...cifra }}>{totales.cobros}</span>
                <span style={{ textAlign: "right", ...cifra }}>
                  {totales.sinCobro === 0 ? "—" : totales.sinCobro}
                </span>
                <span style={{ textAlign: "right", ...cifra, color: "var(--acento)" }}>
                  {pesos(totales.vendido)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Ventas por hora dentro del turno, en una franja baja.
 *
 * Va del principio al final del turno y no sólo de las horas con cobros: un
 * hueco a media mañana es justamente lo que se quiere ver, y saltárselo
 * dibujaría un turno parejo que no existió.
 */
function VentasPorHora({ datos }: { datos: { hora: number; vendido: number }[] }) {
  const primera = datos[0]!.hora;
  const ultima = datos[datos.length - 1]!.hora;
  const porHora = new Map(datos.map((d) => [d.hora, d.vendido]));
  const horas = Array.from({ length: ultima - primera + 1 }, (_, i) => primera + i);
  const maximo = Math.max(...datos.map((d) => d.vendido), 1);

  return (
    <div className="turno-franja">
      <span style={{ fontSize: "12px", color: "var(--texto-tenue)", minWidth: "104px" }}>
        Ventas por hora
      </span>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "5px", height: "52px", minWidth: 0 }}>
        {horas.map((h) => {
          const vendido = porHora.get(h) ?? 0;
          return (
            <span
              key={h}
              title={`${String(h).padStart(2, "0")}:00 — ${vendido > 0 ? pesos(vendido) : "sin cobros"}`}
              style={{
                flex: 1,
                maxWidth: "44px",
                height: `${Math.max(3, (vendido / maximo) * 100)}%`,
                background:
                  vendido === 0
                    ? "var(--borde)"
                    : vendido === maximo
                      ? "var(--marca)"
                      : "var(--borde-control)",
                borderRadius: "3px 3px 0 0",
              }}
            />
          );
        })}
      </div>
      <span style={{ ...cifra, fontSize: "11px", color: "var(--texto-tenue)", whiteSpace: "nowrap" }}>
        {String(primera).padStart(2, "0")} → {String(ultima).padStart(2, "0")} h
      </span>
    </div>
  );
}

/** Lo vendido por tipo de vehículo, en barras comparables. */
function PorTipo({ datos }: { datos: { nombre: string; vendido: number; cobros: number }[] }) {
  const maximo = Math.max(...datos.map((d) => d.vendido), 1);

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {datos.map((t) => (
        <div key={t.nombre} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ minWidth: "88px", fontSize: "13px" }}>{t.nombre}</span>
          <span style={carril}>
            <span
              title={`${t.nombre}: ${pesos(t.vendido)} en ${t.cobros} ${t.cobros === 1 ? "cobro" : "cobros"}`}
              style={{
                display: "block",
                width: `${Math.max(2, (t.vendido / maximo) * 100)}%`,
                height: "100%",
                background: t.vendido === maximo ? "var(--marca)" : "var(--borde-control)",
              }}
            />
          </span>
          <span style={{ ...cifra, fontSize: "12px", minWidth: "44px", textAlign: "right" }}>
            {abreviado(t.vendido)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Pendiente({ texto, valor }: { texto: string; valor: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", fontSize: "13px" }}>
      <span>{texto}</span>
      <strong style={{ ...cifra, fontSize: "15px" }}>{valor}</strong>
    </div>
  );
}

function Cifra({
  rotulo,
  valor,
  pie,
  destacada = false,
}: {
  rotulo: string;
  valor: string;
  pie: string;
  destacada?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "11px", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--texto-tenue)" }}>
        {rotulo}
      </div>
      <div
        style={{
          ...cifra,
          fontSize: "34px",
          fontWeight: 800,
          lineHeight: 1.05,
          marginTop: "4px",
          color: destacada ? "var(--acento)" : "var(--texto)",
        }}
      >
        {valor}
      </div>
      <div style={{ fontSize: "12px", color: "var(--texto-tenue)", marginTop: "2px" }}>{pie}</div>
    </div>
  );
}

const contador: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "normal",
  textTransform: "none",
  color: "var(--texto-tenue)",
};

const carril: CSSProperties = {
  flex: 1,
  height: "7px",
  borderRadius: "999px",
  background: "var(--superficie)",
  overflow: "hidden",
  minWidth: 0,
};
