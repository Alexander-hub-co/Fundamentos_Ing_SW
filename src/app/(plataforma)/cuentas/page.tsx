import Link from "next/link";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { listarCuentas } from "@/dominio/cuentas/listar";
import { listarParqueaderos } from "@/dominio/parqueaderos/listar";
import { agruparPorEstablecimiento } from "@/dominio/cuentas/agrupar";
import { botonMenudo, cifra } from "@/app/ui";
import { NuevaCuenta } from "./nueva-cuenta";
import { ROL_ETIQUETA } from "./etiquetas";

export const metadata = { title: "Cuentas" };

export default async function PaginaCuentas() {
  const contexto = await contextoActual(await headers());

  const [cuentas, establecimientos] = await Promise.all([
    listarCuentas(contexto),
    listarParqueaderos(contexto),
  ]);

  const grupos = agruparPorEstablecimiento(cuentas);

  const anonimizadas = cuentas.filter((c) => c.anonimizada).length;
  const resumen = [
    `${cuentas.length - anonimizadas} activas`,
    anonimizadas > 0 ? `${anonimizadas} anonimizadas` : null,
    "agrupadas por establecimiento",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <NuevaCuenta
        establecimientos={establecimientos
          .filter((p) => p.estado !== "dado_de_baja")
          .map((p) => ({ id: p.id, nombre: p.nombre }))}
        resumen={resumen}
      />

      {cuentas.length === 0 ? (
        <p style={vacio}>Todavía no hay cuentas.</p>
      ) : (
        grupos.map((grupo, i) => (
          <section key={grupo.clave}>
            {/* El nombre del establecimiento va en mayúscula y minúscula, no en
                versalitas como el resto de rótulos: acá no es una etiqueta de
                sección sino el nombre propio de un local, y leerlo así importa
                cuando hay veinte grupos en la página. */}
            <div style={{ ...cabeceraGrupo, marginTop: i === 0 ? 0 : "15px" }}>
              <h2 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{grupo.titulo}</h2>
              <span style={{ ...cifra, fontSize: "12px", color: "var(--texto-tenue)" }}>
                ({grupo.cuentas.length})
              </span>
              {grupo.establecimientoId && (
                <Link
                  href={`/parqueaderos/${grupo.establecimientoId}`}
                  style={{ ...botonMenudo, marginLeft: "auto" }}
                >
                  Ver el establecimiento
                </Link>
              )}
            </div>

            {grupo.nota && (
              <p style={{ margin: "0 0 9px", fontSize: "12px", color: "var(--texto-tenue)" }}>
                {grupo.nota}
              </p>
            )}

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }}>
              {grupo.cuentas.map((c) => (
                // La cuenta anonimizada se atenúa en vez de esconderse. Sigue
                // existiendo y sus registros también; lo que ya no hay es una
                // persona detrás, y eso se ve antes de leer nada.
                <li key={c.id} style={{ ...tarjeta, opacity: c.anonimizada ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                    {c.codigo && (
                      <code style={{ ...cifra, fontSize: "12px", fontWeight: 700, color: "var(--acento)" }}>
                        {c.codigo}
                      </code>
                    )}
                    <Link href={`/cuentas/${c.id}`} style={nombre}>
                      {c.nombre}
                    </Link>
                    {c.anonimizada && (
                      <Marca fondo="var(--texto-tenue)" texto="var(--fondo)" rotulo="Anonimizada" />
                    )}
                    {c.bloqueada && !c.anonimizada && (
                      <Marca fondo="#b91c1c" texto="#ffffff" rotulo="Bloqueada" />
                    )}
                    {c.debeCambiarPassword && !c.anonimizada && (
                      <Marca
                        fondo="var(--aviso-fondo)"
                        texto="var(--aviso-texto)"
                        rotulo="Contraseña temporal"
                      />
                    )}
                    <Link href={`/cuentas/${c.id}`} style={{ ...botonMenudo, marginLeft: "auto" }}>
                      Ver ficha
                    </Link>
                  </div>
                  <p style={{ margin: "1px 0 0", fontSize: "13px", color: "var(--texto-tenue)" }}>
                    {c.email} · {c.rol ? ROL_ETIQUETA[c.rol] : "Sin rol"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function Marca({ fondo, texto, rotulo }: { fondo: string; texto: string; rotulo: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        background: fondo,
        color: texto,
      }}
    >
      {rotulo}
    </span>
  );
}

const cabeceraGrupo: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "8px",
  marginBottom: "9px",
  flexWrap: "wrap",
};

const tarjeta: React.CSSProperties = {
  borderRadius: "10px",
  background: "var(--superficie)",
  padding: "11px 16px",
};

const nombre: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--texto)",
  textDecoration: "none",
};

const vacio: React.CSSProperties = {
  padding: "2.5rem 1.5rem",
  textAlign: "center",
  color: "var(--texto-tenue)",
  border: "1px dashed var(--borde)",
  borderRadius: "14px",
};
