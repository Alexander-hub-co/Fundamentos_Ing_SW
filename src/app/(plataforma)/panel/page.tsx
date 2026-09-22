import Link from "next/link";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { obtenerResumenPlataforma } from "@/dominio/plataforma/resumen";
import { ultimosAccesosDenegados } from "@/dominio/auditoria/acceso-denegado";
import { cifra, rotuloSeccion } from "@/app/ui";
import type { EstadoParqueadero } from "@/db/esquema";

export const metadata = { title: "Panel" };

const ETIQUETA: Record<EstadoParqueadero, string> = {
  activo: "Activos",
  pendiente: "Pendientes",
  suspendido: "Suspendidos",
  dado_de_baja: "Dados de baja",
};

/**
 * El color va en una barrita sobre la cifra, no en la cifra.
 *
 * Un número en rojo se lee como "esto está mal"; el rojo aquí sólo dice de qué
 * estado se habla. Además el verde de marca no alcanza contraste como texto
 * sobre claro, y así el mismo código sirve en los dos temas.
 */
const COLOR: Record<EstadoParqueadero, string> = {
  activo: "var(--marca)",
  pendiente: "var(--aviso-fondo)",
  suspendido: "var(--error-texto)",
  dado_de_baja: "var(--texto-tenue)",
};

const ORDEN: EstadoParqueadero[] = ["activo", "pendiente", "suspendido", "dado_de_baja"];

/** Cuántos intentos denegados se muestran. Es un vistazo, no el registro completo. */
const DENEGADOS_EN_PANEL = 10;

export default async function Panel() {
  const contexto = await contextoActual(await headers());
  const resumen = await obtenerResumenPlataforma(contexto);
  const denegados = (await ultimosAccesosDenegados(DENEGADOS_EN_PANEL)).slice(0, DENEGADOS_EN_PANEL);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 style={{ margin: "0 0 22px", fontSize: "24px", fontWeight: 800 }}>Panel</h1>

      {/* ── Establecimientos ─────────────────────────────────────────── */}
      <Encabezado rotulo="Establecimientos" enlace={{ href: "/parqueaderos", texto: "Ver todos" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "12px" }}>
        {ORDEN.map((estado) => (
          <Tarjeta key={estado} barra={COLOR[estado]} cifra={resumen.establecimientos[estado] ?? 0} rotulo={ETIQUETA[estado]} />
        ))}
      </div>

      <p style={nota}>
        {resumen.totalEstablecimientos} establecimientos en total. La suma de los cuatro estados
        siempre coincide con este número.
      </p>

      {/* ── Cuentas ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: "24px" }}>
        <Encabezado rotulo="Cuentas" enlace={{ href: "/cuentas", texto: "Administrar" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "12px" }}>
        <Tarjeta cifra={resumen.cuentas} rotulo="Activas" />
        <Tarjeta cifra={resumen.cuentasAnonimizadas} rotulo="Anonimizadas" />
        <div style={{ ...tarjetaBase, gridColumn: "span 2", fontSize: "12px", color: "var(--texto-tenue)", lineHeight: 1.5 }}>
          Las cuentas anonimizadas se informan aparte y no suman al total: ya no representan a
          ninguna persona, pero sus registros históricos se conservan.
        </div>
      </div>

      {/* ── Auditoría de aislamiento ─────────────────────────────────── */}
      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "10px" }}>
          <span style={{ ...rotuloSeccion, margin: 0 }}>Intentos de acceso denegados</span>
          <span style={{ ...cifra, fontSize: "12px", color: "var(--texto-tenue)" }}>
            ({denegados.length})
          </span>
        </div>

        <div style={{ ...tarjetaBase, padding: 0, overflow: "hidden" }}>
          {denegados.length === 0 ? (
            <p style={{ margin: 0, padding: "16px", fontSize: "13px", color: "var(--texto-tenue)", lineHeight: 1.5 }}>
              Nadie ha intentado alcanzar un recurso fuera de su alcance. Es lo esperado; si esta
              lista crece, alguien está probando identificadores ajenos.
            </p>
          ) : (
            denegados.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  padding: "10px 16px",
                  fontSize: "13px",
                  borderTop: i === 0 ? "none" : "1px solid var(--borde)",
                }}
              >
                <code style={{ ...cifra, color: "var(--texto)" }}>{d.recurso}</code>
                <span style={{ ...cifra, color: "var(--texto-tenue)" }}>
                  {d.ocurridoEn.toLocaleString("es-CO")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Rótulo de sección con su acción a la derecha. */
function Encabezado({
  rotulo,
  enlace,
}: {
  rotulo: string;
  enlace: { href: string; texto: string };
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
      <span style={{ ...rotuloSeccion, margin: 0 }}>{rotulo}</span>
      <Link
        href={enlace.href}
        style={{
          fontSize: "13px",
          padding: "5px 11px",
          border: "1px solid var(--borde-control)",
          borderRadius: "8px",
          color: "var(--boton-secundario-texto)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {enlace.texto}
      </Link>
    </div>
  );
}

/** Una cifra grande con su rótulo, y una barrita de color si el estado la tiene. */
function Tarjeta({ barra, cifra: valor, rotulo }: { barra?: string; cifra: number; rotulo: string }) {
  return (
    <div style={tarjetaBase}>
      {barra && (
        <span
          aria-hidden="true"
          style={{ display: "block", width: "32px", height: "4px", borderRadius: "999px", background: barra, marginBottom: "12px" }}
        />
      )}
      <div style={{ ...cifra, fontSize: "32px", fontWeight: 800, lineHeight: 1.05 }}>{valor}</div>
      <div style={{ fontSize: "13px", color: "var(--texto-tenue)", marginTop: "2px" }}>{rotulo}</div>
    </div>
  );
}

const tarjetaBase: React.CSSProperties = {
  borderRadius: "12px",
  padding: "16px 18px",
};

const nota: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "12px",
  color: "var(--texto-tenue)",
};
