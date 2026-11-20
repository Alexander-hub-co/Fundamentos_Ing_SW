import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import {
  botonSecundario,
  campoTexto,
  importe as estiloImporte,
  rotuloSeccion,
  textoTenue,
  tituloPantalla,
} from "@/app/ui";
import { ArmazonEstablecimiento } from "../nav";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { cobrosDelPeriodo, PERIODOS, type Periodo } from "@/dominio/reportes/cobros";
import { puede } from "@/lib/autorizacion";
import { ListaDeCobros } from "./lista";

export const metadata = { title: "Últimos cobros" };

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * Los cobros ya cerrados.
 *
 * Vive acá y no en la taquilla a propósito: al lado del campo de placa competía
 * con lo único que quien atiende necesita mirar con fila. La taquilla se queda
 * con quién está ADENTRO ahora; lo que ya salió se revisa cuando hay tiempo,
 * que es cuando de verdad se cuadra la caja.
 */
export default async function Cobros({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; placa?: string; fecha?: string }>;
}) {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado === "dado_de_baja") redirect("/restringido");

  const parametros = await searchParams;
  const pedido = parametros.periodo;
  const periodo: Periodo = PERIODOS.some((p) => p.valor === pedido)
    ? (pedido as Periodo)
    : "hoy";

  const resumen = await cobrosDelPeriodo(contexto, periodo, new Date(), {
    placa: parametros.placa,
    fecha: parametros.fecha,
  });
  const { placa, fecha } = resumen.filtro;
  const buscando = placa !== null || fecha !== null;

  return (
    <ArmazonEstablecimiento>
      <header style={cabecera}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "14rem" }}>
            <h1 style={{ ...tituloPantalla, margin: 0 }}>Últimos cobros</h1>
            <p style={{ ...textoTenue, marginTop: "10px", maxWidth: "52em" }}>
              {resumen.soloMios
                ? "Lo que usted ha cobrado en sus turnos. Los cobros de sus compañeros no aparecen acá."
                : "Todo lo que este establecimiento ha cobrado, de quien sea que lo haya atendido."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
            {PERIODOS.map((p) => (
              <Link
                key={p.valor}
                href={`/cobros?periodo=${p.valor}`}
                style={p.valor === periodo ? pastillaActiva : pastilla}
              >
                {p.titulo}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* El total, arriba y grande.
          Es la respuesta a la pregunta que da nombre a la pantalla, y estaba
          metido en una caja de la columna derecha, debajo de la lista. Lo que
          lo acompaña va en una línea: cuántos cobros, y cuánto se dejó de
          cobrar, que es lo que hace falta para cuadrar la caja. */}
      <section style={{ marginBottom: "44px" }}>
        <p
          style={{
            ...estiloImporte,
            fontSize: "46px",
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          {pesos(resumen.total)}
        </p>
        <p style={{ ...textoTenue, marginTop: "8px" }}>
          Cobrado{" "}
          {buscando
            ? "en los resultados de la búsqueda"
            : resumen.periodo === "hoy"
              ? "hoy"
              : resumen.periodo === "mes"
                ? "este mes"
                : "en seis meses"}
          , con las correcciones ya aplicadas: es lo que debería estar en la caja.
          {resumen.cortesias.cuantas > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--aviso-tinta)" }}>
                {resumen.cortesias.cuantas}{" "}
                {resumen.cortesias.cuantas === 1
                  ? "salida sin cobro"
                  : "salidas sin cobro"}{" "}
                por {pesos(resumen.cortesias.omitido)}
              </span>
            </>
          )}
        </p>
      </section>

      {/* Búsqueda en el historial (#8). Es un GET a la misma página: la búsqueda
          queda en la dirección y se puede guardar o compartir. */}
      <form method="get" role="search" style={buscador}>
        <input type="hidden" name="periodo" value={periodo} />
        <label style={campo}>
          <span style={textoTenue}>Placa</span>
          <input
            name="placa"
            defaultValue={placa ?? ""}
            placeholder="ABC123"
            autoComplete="off"
            style={campoTexto}
          />
        </label>
        <label style={campo}>
          <span style={textoTenue}>Fecha de salida</span>
          <input
            type="date"
            name="fecha"
            defaultValue={fecha ?? ""}
            style={campoTexto}
          />
        </label>
        <button type="submit" style={botonSecundario}>
          Buscar en el historial
        </button>
        {buscando && (
          <Link
            href={`/cobros?periodo=${periodo}`}
            style={{ ...textoTenue, alignSelf: "center" }}
          >
            Quitar la búsqueda
          </Link>
        )}
      </form>

      {buscando && resumen.cobros.length === 0 && (
        <p role="status" style={{ ...textoTenue, marginBottom: "34px" }}>
          Sin resultados
          {placa ? ` para la placa ${placa}` : ""}
          {fecha ? ` el ${fecha}` : ""}. Revise la placa o pruebe con otra fecha.
        </p>
      )}

      {/* La lista a lo ancho. En dos columnas cada renglón tenía que meter la
          placa, la hora, el tipo y el importe en media pantalla. */}
      {!(buscando && resumen.cobros.length === 0) && (
        <section>
          <h2 className="rotulo-filete" style={rotuloSeccion}>
            {resumen.cobros.length} {resumen.cobros.length === 1 ? "cobro" : "cobros"}
          </h2>

          <ListaDeCobros
            cobros={resumen.cobros}
            puedeCorregir={puede(contexto, "movimiento.corregir")}
          />
        </section>
      )}
    </ArmazonEstablecimiento>
  );
}

const buscador: CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "flex-end",
  marginBottom: "34px",
};

const campo: CSSProperties = { display: "grid", gap: "6px", minWidth: "12rem" };

const cabecera: CSSProperties = {
  paddingBottom: "22px",
  marginBottom: "34px",
  borderBottom: "1px solid var(--borde)",
};

const pastilla: CSSProperties = {
  ...botonSecundario,
  fontSize: "12px",
  padding: "6px 12px",
  borderRadius: "999px",
  color: "var(--texto-tenue)",
  borderColor: "var(--borde)",
};

const pastillaActiva: CSSProperties = {
  ...pastilla,
  fontWeight: 700,
  color: "var(--texto)",
  borderColor: "var(--borde-control)",
};
