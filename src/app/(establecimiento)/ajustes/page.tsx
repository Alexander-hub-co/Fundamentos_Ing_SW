import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { textoTenue, tituloPantalla } from "@/app/ui";
import { ArmazonEstablecimiento } from "../nav";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { preferenciasDe } from "@/dominio/preferencias/gestionar";
import { FormularioAjustes } from "@/app/ajustes-formulario";
import { SeccionDeCuenta } from "@/app/seccion-cuenta";

export const metadata = { title: "Ajustes" };

/**
 * Ajustes de apariencia y de taquilla (maqueta 8d).
 *
 * Los abre cualquiera que entre, incluido un operario: son preferencias de la
 * propia cuenta, no configuración del establecimiento. Por eso tampoco exigen
 * permiso —nadie necesita autorización para elegir de qué color ve su
 * pantalla— y por eso la pantalla sigue disponible con el establecimiento
 * suspendido, donde lo que se corta es operar, no ver.
 */
export default async function Ajustes() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/configuracion");

  const preferencias = await preferenciasDe(contexto);

  return (
    <ArmazonEstablecimiento>
      <header style={cabecera}>
        <h1 style={{ ...tituloPantalla, margin: 0 }}>Ajustes</h1>
        <p style={{ ...textoTenue, marginTop: "10px", maxWidth: "52em" }}>
          La apariencia la elige la persona, nunca el sistema operativo. La preferencia se guarda
          por cuenta, así que un operario puede trabajar en oscuro aunque usted use el claro.
        </p>
      </header>

      <FormularioAjustes inicial={preferencias} />

      <SeccionDeCuenta />
    </ArmazonEstablecimiento>
  );
}

const cabecera: React.CSSProperties = {
  paddingBottom: "22px",
  marginBottom: "36px",
  borderBottom: "1px solid var(--borde)",
};
