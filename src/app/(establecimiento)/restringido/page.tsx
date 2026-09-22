import { headers } from "next/headers";
import { botonTenue, tituloPantalla } from "@/app/ui";
import { redirect } from "next/navigation";
import { Wordmark } from "@/app/wordmark";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { obtenerMiParqueadero } from "@/dominio/parqueaderos/listar";
import { cerrarSesion } from "../../(auth)/login/acciones";

export const metadata = { title: "Servicio restringido" };

/**
 * Mensaje al usuario de un establecimiento suspendido (FR-030).
 *
 * Dice el motivo Y qué puede seguir haciendo. Lo segundo importa tanto como lo
 * primero: un operario con la fila de clientes esperando necesita saber en
 * cinco segundos si puede seguir trabajando o no.
 *
 * No expone datos comerciales de la cuenta —cuánto se debe, desde cuándo—
 * porque quien está mirando esta pantalla suele ser un empleado, no el dueño.
 */
export default async function ServicioRestringido() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    // FR-033: la contraseña temporal debe cambiarse antes que nada.
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado === "activo" || contexto.estado === "pendiente") {
    redirect("/establecimiento");
  }

  const propio = await obtenerMiParqueadero(contexto).catch(() => null);
  const dadoDeBaja = contexto.estado === "dado_de_baja";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{ maxWidth: "28rem", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
          <Wordmark tamano={30} />
        </div>

        <div
          style={{
                      borderRadius: "14px",
            padding: "1.75rem 1.5rem",
            background: "var(--superficie)",
            textAlign: "left",
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.125rem 0.5rem",
              borderRadius: "999px",
              background: dadoDeBaja ? "var(--texto-tenue)" : "#f59e0b",
              color: dadoDeBaja ? "#ffffff" : "var(--marca-sobre)",
            }}
          >
            {dadoDeBaja ? "Servicio finalizado" : "Servicio suspendido"}
          </span>

          <h1 style={tituloPantalla}>
            {propio?.nombre ?? "Tu establecimiento"}
          </h1>

          {dadoDeBaja ? (
            <p style={{ margin: 0, color: "var(--texto-tenue)" }}>
              El servicio de este establecimiento fue dado de baja. Ninguna
              función está disponible.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 1rem", color: "var(--texto-tenue)" }}>
                El servicio está suspendido temporalmente. Puede cerrar y cobrar lo
                que ya está en curso, pero no registrar entradas nuevas.
              </p>

              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem" }}>
                Qué puede hacer ahora:
              </p>
              <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.25rem", color: "var(--texto-tenue)" }}>
                <li>Registrar la salida de los vehículos que ya están adentro</li>
                <li>Cobrarles normalmente</li>
                <li>Consultar los datos de tu establecimiento</li>
              </ul>
            </>
          )}

          <p
            style={{
              margin: "1.5rem 0 0",
              paddingTop: "1rem",
              borderTop: "1px solid var(--borde)",
              fontSize: "0.875rem",
              color: "var(--texto-tenue)",
            }}
          >
            Para restablecer el servicio, comuníquese con el administrador de la
            plataforma.
          </p>
        </div>

        <form action={cerrarSesion} style={{ marginTop: "1.5rem" }}>
          <button type="submit" style={botonTenue}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
