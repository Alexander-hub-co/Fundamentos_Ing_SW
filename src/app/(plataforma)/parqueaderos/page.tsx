import Link from "next/link";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { listarParqueaderos } from "@/dominio/parqueaderos/listar";
import { botonMenudo, botonPrimario, cifra } from "@/app/ui";
import type { EstadoParqueadero } from "@/db/esquema";

export const metadata = { title: "Parqueaderos" };

const ETIQUETA: Record<EstadoParqueadero, string> = {
  activo: "Activo",
  pendiente: "Pendiente",
  suspendido: "Suspendido",
  dado_de_baja: "Dado de baja",
};

const PLURAL: Record<EstadoParqueadero, string> = {
  activo: "Activos",
  pendiente: "Pendientes",
  suspendido: "Suspendidos",
  dado_de_baja: "Dados de baja",
};

const ORDEN: EstadoParqueadero[] = ["activo", "pendiente", "suspendido", "dado_de_baja"];

/**
 * Insignias de estado. El color de texto de cada una se eligió midiendo, no a
 * ojo: sobre verde y ámbar el azul contrasta mucho mejor que el blanco, y
 * ponerlas todas en blanco dejaba la de "pendiente" en 2.15:1, ilegible.
 * Estos son textos pequeños, así que el mínimo exigible es 4.5:1.
 */
const INSIGNIA: Record<EstadoParqueadero, { fondo: string; texto: string }> = {
  activo: { fondo: "var(--marca)", texto: "var(--marca-sobre)" }, //         7.49:1
  pendiente: { fondo: "var(--aviso-fondo)", texto: "var(--aviso-texto)" }, // 8.01:1
  suspendido: { fondo: "#b91c1c", texto: "#ffffff" }, //              6.47:1
  dado_de_baja: { fondo: "var(--texto-tenue)", texto: "#ffffff" }, // 5.74:1
};

function esEstado(v: string | undefined): v is EstadoParqueadero {
  return v !== undefined && (ORDEN as string[]).includes(v);
}

export default async function PaginaParqueaderos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const contexto = await contextoActual(await headers());
  const todos = await listarParqueaderos(contexto);

  const { estado } = await searchParams;
  const filtro = esEstado(estado) ? estado : null;
  const visibles = filtro ? todos.filter((p) => p.estado === filtro) : todos;

  const cuantos = (e: EstadoParqueadero) => todos.filter((p) => p.estado === e).length;

  return (
    <>
      <div style={cabecera}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Parqueaderos</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--texto-tenue)" }}>
            {todos.length} {todos.length === 1 ? "establecimiento" : "establecimientos"} ·{" "}
            {cuantos("activo")} {cuantos("activo") === 1 ? "activo" : "activos"}
          </p>
        </div>

        <Link href="/parqueaderos/nuevo" style={botonPrimario}>
          Nuevo parqueadero
        </Link>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────────
          Son enlaces y no botones: el estado del filtro vive en la URL, así
          que se puede compartir "muéstrame los suspendidos" y el botón de
          atrás del navegador hace lo que se espera. */}
      <div style={{ display: "flex", gap: "7px", marginBottom: "14px", flexWrap: "wrap" }}>
        <Chip href="/parqueaderos" texto="Todos" cuantos={todos.length} activo={filtro === null} />
        {ORDEN.map((e) => (
          <Chip
            key={e}
            href={`/parqueaderos?estado=${e}`}
            texto={PLURAL[e]}
            cuantos={cuantos(e)}
            activo={filtro === e}
          />
        ))}
      </div>

      {visibles.length === 0 ? (
        <p style={vacio}>
          {filtro
            ? `Ningún establecimiento está en estado "${ETIQUETA[filtro].toLowerCase()}".`
            : "Todavía no hay ningún establecimiento. Cree el primero para empezar."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {visibles.map((p) => (
            <article key={p.id} style={tarjeta}>
              <div style={{ display: "flex", alignItems: "center", gap: "11px", flexWrap: "wrap" }}>
                <Link
                  href={`/parqueaderos/${p.id}`}
                  style={{ fontSize: "17px", fontWeight: 800, color: "var(--texto)", textDecoration: "none" }}
                >
                  {p.nombre}
                </Link>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: "999px",
                    background: INSIGNIA[p.estado].fondo,
                    color: INSIGNIA[p.estado].texto,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ETIQUETA[p.estado]}
                </span>
                <code style={{ ...cifra, fontSize: "13px", color: "var(--texto-tenue)" }}>
                  {p.codigo}
                </code>
                <Link href={`/parqueaderos/${p.id}`} style={{ ...botonMenudo, marginLeft: "auto" }}>
                  Ver ficha
                </Link>
              </div>

              <p style={renglon}>
                {[p.ciudad, p.direccion].filter(Boolean).join(" · ") || "Sin dirección registrada"}
              </p>
              <p style={{ ...renglon, marginTop: "2px" }}>
                {p.responsables.length === 0
                  ? "Sin responsable asignado"
                  : `Responsable: ${p.responsables.map((r) => r.nombre).join(", ")}`}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Chip({
  href,
  texto,
  cuantos,
  activo,
}: {
  href: string;
  texto: string;
  cuantos: number;
  activo: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      style={{
        display: "inline-flex",
        gap: "6px",
        fontSize: "12px",
        fontWeight: activo ? 700 : 400,
        padding: "5px 12px",
        borderRadius: "999px",
        background: "var(--superficie)",
        border: `1px solid ${activo ? "var(--borde-control)" : "var(--borde)"}`,
        color: activo ? "var(--texto)" : "var(--texto-tenue)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {texto} <span style={cifra}>{cuantos}</span>
    </Link>
  );
}

const cabecera: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "18px",
  flexWrap: "wrap",
};



const tarjeta: React.CSSProperties = {
  borderRadius: "12px",
  padding: "15px 18px",
};

const renglon: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "13px",
  color: "var(--texto-tenue)",
};

const vacio: React.CSSProperties = {
  padding: "2.5rem 1.5rem",
  textAlign: "center",
  color: "var(--texto-tenue)",
  border: "1px dashed var(--borde)",
  borderRadius: "14px",
};
