import Link from "next/link";
import { botonTenue, tituloPantalla } from "@/app/ui";
import { headers } from "next/headers";
import { type EstadoParqueadero } from "@/db/esquema";
import { contextoActual } from "@/lib/sesion";
import { exigir } from "@/lib/autorizacion";
import { obtenerParqueadero } from "@/dominio/parqueaderos/listar";
import { transicionesPosibles } from "@/dominio/parqueaderos/estados";
import { historialDeEstados } from "@/dominio/parqueaderos/historial-estado";
import { FormularioEstado } from "./formulario";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export const metadata = { title: "Estado del parqueadero" };

const ETIQUETA: Record<EstadoParqueadero, string> = {
  activo: "Activo",
  pendiente: "Pendiente",
  suspendido: "Suspendido",
  dado_de_baja: "Dado de baja",
};

const EXPLICACION: Record<EstadoParqueadero, string> = {
  activo: "Opera con normalidad.",
  pendiente:
    "Opera igual que activo. Es una marca de gestión —el cliente adeuda, pero todavía no se le corta el servicio— sin ninguna consecuencia para el establecimiento.",
  suspendido:
    "Modo restringido: puede cerrar y cobrar lo que ya está adentro, pero no registrar entradas nuevas.",
  dado_de_baja:
    "Sin acceso. Su información se conserva íntegra y sólo se sale reactivándolo.",
};

export default async function EstadoParqueaderoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // `params` es asíncrono desde Next 16.
  const { id } = await params;
  const contexto = await contextoActual(await headers());
  exigir(contexto, "parqueadero.cambiar_estado");

  // Se pasa por el dominio a propósito: la interfaz nunca alcanza la conexión
  // privilegiada por su cuenta, y la prueba V5 lo verifica.
  const actual = await obtenerParqueadero(contexto, id);
  if (!actual) throw await errorDeAlcance(contexto, `parqueadero:${id}`);

  const historial = await historialDeEstados(id);
  const posibles = transicionesPosibles(actual.estado);

  return (
    <>
      <Link href="/parqueaderos" style={botonTenue}>
        ← Volver
      </Link>

      <h1 style={tituloPantalla}>{actual.nombre}</h1>
      <code style={{ fontSize: "0.875rem", color: "var(--texto-tenue)" }}>{actual.codigo}</code>

      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem 1.25rem",
                  borderRadius: "14px",
          background: "var(--superficie)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>
          Estado actual
        </p>
        <p style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>
          {ETIQUETA[actual.estado]}
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--texto-tenue)" }}>
          {EXPLICACION[actual.estado]}
        </p>
      </div>

      <FormularioEstado
        parqueaderoId={id}
        posibles={posibles.map((e) => ({
          valor: e,
          etiqueta: ETIQUETA[e],
          explicacion: EXPLICACION[e],
        }))}
      />

      <section style={{ marginTop: "3rem" }}>
        <h2 style={{ fontSize: "0.8125rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--texto-tenue)" }}>
          Historial
        </h2>

        {historial.length === 0 ? (
          <p style={{ color: "var(--texto-tenue)", fontSize: "0.9375rem" }}>
            Sin cambios de estado registrados.
          </p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
            {historial.map((h, i) => (
              <li
                key={i}
                style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--borde)" }}
              >
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                  <strong style={{ fontSize: "0.9375rem" }}>
                    {h.estadoAnterior ? `${h.estadoAnterior} → ` : ""}
                    {h.estadoNuevo}
                  </strong>
                  <span style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>
                    {h.ocurridoEn.toLocaleString("es-CO")}
                  </span>
                </div>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>{h.motivo}</p>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--texto-tenue)" }}>
                  {h.ejecutadoPor ?? "—"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
