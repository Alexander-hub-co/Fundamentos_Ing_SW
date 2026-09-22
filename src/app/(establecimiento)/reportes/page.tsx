import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { botonSecundario, cifra, rotuloSeccion, textoTenue, tituloPantalla } from "@/app/ui";
import { ArmazonEstablecimiento } from "../nav";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { reporteDelEstablecimiento } from "@/dominio/reportes/resumen";
import { PERIODOS, type Periodo } from "@/dominio/reportes/rangos";
import { EntradasPorHora, IngresosPorDia, IngresosPorHora, IngresosPorPersona } from "./graficos";

export const metadata = { title: "Reportes" };

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/** "2h 51m", como en la maqueta. */
function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Reportes del establecimiento (maqueta 2i).
 *
 * La frase del subtítulo no es adorno: **cada movimiento guardó copia de la
 * tarifa y de los convenios aplicados al cobrar**, y ésa es la razón por la que
 * estas cifras se pueden creer. Un reporte que recalculara con los precios de
 * hoy contaría otra historia cada vez que alguien cambia uno.
 *
 * La misma pantalla sirve al administrador y al operario; lo que cambia es el
 * alcance. Un operario ve sólo lo que él cobró, porque comparar cajas con sus
 * compañeros no es asunto suyo. Eso lo decide el dominio, no esta pantalla.
 */
export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");

  if (contexto.estado === "dado_de_baja") redirect("/restringido");

  const pedido = (await searchParams).periodo;
  const periodo: Periodo = PERIODOS.some((p) => p.valor === pedido)
    ? (pedido as Periodo)
    : "semana";

  const reporte = await reporteDelEstablecimiento(contexto, periodo);

  return (
    <ArmazonEstablecimiento>
      <header style={cabecera}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "16rem" }}>
          <h1 style={{ ...tituloPantalla, margin: 0 }}>Reportes</h1>
          <p style={{ ...textoTenue, marginTop: "10px", maxWidth: "52em" }}>
            {reporte?.soloMios
              ? "Lo que usted ha cobrado. Cada movimiento guardó copia de la tarifa y el convenio aplicados."
              : "Cada movimiento guardó copia de la tarifa y el convenio aplicados al cobrar."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
          {PERIODOS.map((p) => (
            <Link
              key={p.valor}
              href={`/reportes?periodo=${p.valor}`}
              style={p.valor === periodo ? pastillaActiva : pastilla}
            >
              {p.titulo}
            </Link>
          ))}
        </div>
      </div>
      </header>

      {!reporte ? (
        <p style={{ ...textoTenue, maxWidth: "52em" }}>
          Todavía no se ha abierto ningún turno, así que no hay un período de turno del que
          informar. Elija otro período, o abra el turno en la taquilla.
        </p>
      ) : (
        <>
          <div className="reportes-cifras">
            <Cifra rotulo="Ingresos" valor={pesos(reporte.actual.ingresos)} destacada
              pie={
                reporte.variacionIngresos === null
                  ? "sin período anterior con el que comparar"
                  : `${reporte.variacionIngresos >= 0 ? "+" : ""}${reporte.variacionIngresos.toFixed(1).replace(".", ",")} % frente ${reporte.rango.etiqueta === "hoy" ? "a ayer" : "al período anterior"}`
              }
            />
            <Cifra
              rotulo="Movimientos"
              valor={reporte.actual.movimientos.toLocaleString("es-CO")}
              pie={`cerrados ${reporte.rango.etiqueta}`}
            />
            <Cifra
              rotulo="Permanencia media"
              valor={reporte.actual.permanenciaMedia === null ? "—" : duracion(reporte.actual.permanenciaMedia)}
              pie={
                reporte.porTipo.length > 0
                  ? reporte.porTipo
                      .map((t) => `${t.nombre.toLowerCase()} ${duracion(t.permanenciaMedia)}`)
                      .join(" · ")
                  : "sin movimientos cerrados"
              }
            />
            <Cifra
              rotulo="Ticket promedio"
              valor={reporte.actual.ticketPromedio === null ? "—" : pesos(reporte.actual.ticketPromedio)}
              pie={
                reporte.actual.porcentajeEnPlena === null
                  ? "sin movimientos cerrados"
                  : `${Math.round(reporte.actual.porcentajeEnPlena)} % de los cobros topó la plena`
              }
            />
          </div>

          <div className="reportes-columnas">
            {/* Por hora cuando el período es UN día o un turno; por día en
                una semana o un mes. Un gráfico de barras con una sola barra no
                compara con nada. */}
            <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              {reporte.porDia.length === 0 ? (
                <>
                  <h2 className="rotulo-filete" style={{ ...rotuloSeccion, margin: 0 }}>
                    Ingresos por hora
                  </h2>
                  <IngresosPorHora datos={reporte.ingresosPorHora} />
                </>
              ) : (
                <>
                  <h2 className="rotulo-filete" style={{ ...rotuloSeccion, margin: 0 }}>
                    Ingresos por día
                  </h2>
                  <IngresosPorDia datos={reporte.porDia} />
                </>
              )}
            </section>

            <div style={{ display: "flex", flexDirection: "column", gap: "44px", minWidth: 0 }}>
              <section>
                <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "14px" }}>Ingresos por persona</h2>
                <IngresosPorPersona datos={reporte.porPersona} />
              </section>

              <section>
                <h2 className="rotulo-filete" style={{ ...rotuloSeccion, marginBottom: "12px" }}>Horas de mayor demanda</h2>
                <EntradasPorHora datos={reporte.porHora} />
                <p style={{ ...textoTenue, marginTop: "12px", fontSize: "12px" }}>
                  Se cuenta la entrada y no la salida: lo que esto decide es a qué hora hace
                  falta más gente en la caseta.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </ArmazonEstablecimiento>
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
    <div style={tarjetaCifra}>
      <div style={{ fontSize: "11px", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--texto-tenue)" }}>
        {rotulo}
      </div>
      <div
        style={{
          ...cifra,
          fontSize: "27px",
          fontWeight: 800,
          lineHeight: 1.1,
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

const cabecera: CSSProperties = {
  paddingBottom: "22px",
  marginBottom: "36px",
  borderBottom: "1px solid var(--borde)",
};

/**
 * Una de las cuatro cifras de arriba. Sin caja.
 *
 * Cuatro rellenos iguales en fila es el patrón que más se repite en cualquier
 * panel generado, y además aplanaba la jerarquía: los ingresos y el ticket
 * promedio pesaban lo mismo. Ahora las separa un filete vertical, y la primera
 * —los ingresos, que es la que se viene a mirar— va en el color de marca.
 */
const tarjetaCifra: CSSProperties = {
  padding: "2px 20px 2px 0",
  borderRight: "1px solid var(--borde)",
  minWidth: 0,
};

const pastilla: CSSProperties = {
  ...botonSecundario,
  fontSize: "12px",
  padding: "6px 12px",
  borderRadius: "999px",
  background: "var(--superficie)",
  color: "var(--texto-tenue)",
  borderColor: "var(--borde)",
};

const pastillaActiva: CSSProperties = {
  ...pastilla,
  fontWeight: 700,
  color: "var(--texto)",
  borderColor: "var(--borde-control)",
};
