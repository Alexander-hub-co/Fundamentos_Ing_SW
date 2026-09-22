import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import {
  botonMenudo,
  botonSecundario,
  cifra,
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
    : "hoy";

  const resumen = await cobrosDelPeriodo(contexto, periodo);

  return (
    <ArmazonEstablecimiento>
      <header style={cabecera}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
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
        <p style={{ ...estiloImporte, fontSize: "46px", margin: 0, letterSpacing: "-0.03em" }}>
          {pesos(resumen.total)}
        </p>
        <p style={{ ...textoTenue, marginTop: "8px" }}>
          Cobrado {resumen.periodo === "hoy" ? "hoy" : resumen.periodo === "mes" ? "este mes" : "en seis meses"}
          , con las correcciones ya aplicadas: es lo que debería estar en la caja.
          {resumen.cortesias.cuantas > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--aviso-tinta)" }}>
                {resumen.cortesias.cuantas}{" "}
                {resumen.cortesias.cuantas === 1 ? "salida sin cobro" : "salidas sin cobro"} por{" "}
                {pesos(resumen.cortesias.omitido)}
              </span>
            </>
          )}
        </p>
      </section>

      {/* La lista a lo ancho. En dos columnas cada renglón tenía que meter la
          placa, la hora, el tipo y el importe en media pantalla. */}
      <section>
        <h2 className="rotulo-filete" style={rotuloSeccion}>
          {resumen.cobros.length} {resumen.cobros.length === 1 ? "cobro" : "cobros"}
        </h2>

        <ListaDeCobros cobros={resumen.cobros} puedeCorregir={puede(contexto, "movimiento.corregir")} />
      </section>
    </ArmazonEstablecimiento>
  );
}

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

/** Con la zona fija: el servidor puede estar en UTC. */
function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(d);
}


