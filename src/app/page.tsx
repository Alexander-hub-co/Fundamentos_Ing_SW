import { Wordmark } from "./wordmark";
import Link from "next/link";
import { botonPrimario, cifra, rotuloSeccion } from "./ui";

const FASES = [
  { n: 1, nombre: "Andamiaje del proyecto", listo: true },
  { n: 2, nombre: "Aislamiento y autenticación", listo: true },
  { n: 3, nombre: "Alta de parqueaderos", listo: true },
  { n: 4, nombre: "Aislamiento verificado", listo: true },
  { n: 5, nombre: "Suspender y reactivar", listo: true },
  { n: 6, nombre: "Ciclo de vida de cuentas", listo: true },
  { n: 7, nombre: "Panel global", listo: true },
] as const;

const COMPLETADAS = FASES.filter((f) => f.listo).length;

export default function Home() {
  return (
    <main
      style={{
        maxWidth: "40rem",
        margin: "0 auto",
        padding: "4rem 1.5rem 5rem",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Wordmark tamano={44} eslogan />
      </div>

      <Link
        href="/login"
        style={{ ...botonPrimario, marginTop: "2rem", padding: "0.75rem 2rem", fontSize: "1rem" }}
      >
        Ingresar
      </Link>

      <section style={{ marginTop: "4rem", textAlign: "left" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.75rem",
          }}
        >
          <h2 className="rotulo-filete" style={{ ...rotuloSeccion, margin: 0 }}>Avance del desarrollo</h2>
          <span style={{ ...cifra, fontSize: "13px", color: "var(--texto-tenue)" }}>
            {COMPLETADAS} de {FASES.length}
          </span>
        </div>

        {/* El verde como relleno, que es donde sí cumple contraste. */}
        <div
          role="progressbar"
          aria-valuenow={COMPLETADAS}
          aria-valuemin={0}
          aria-valuemax={FASES.length}
          aria-label="Avance del desarrollo"
          style={{
            height: "0.5rem",
            borderRadius: "999px",
            background: "var(--borde)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(COMPLETADAS / FASES.length) * 100}%`,
              height: "100%",
              background: "var(--marca)",
            }}
          />
        </div>

        <ol style={{ listStyle: "none", padding: 0, margin: "1.5rem 0 0" }}>
          {FASES.map((fase) => (
            <li
              key={fase.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                padding: "0.6875rem 0",
                borderBottom: "1px solid var(--borde)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  flexShrink: 0,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  background: fase.listo ? "var(--marca)" : "transparent",
                  color: fase.listo ? "var(--marca-sobre)" : "var(--texto-tenue)",
                  border: fase.listo ? "none" : "1px solid var(--borde)",
                }}
              >
                {fase.listo ? "✓" : fase.n}
              </span>
              <span
                style={{ color: fase.listo ? "var(--texto)" : "var(--texto-tenue)" }}
              >
                {fase.nombre}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
