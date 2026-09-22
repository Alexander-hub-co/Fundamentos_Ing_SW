import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { textoTenue, tituloPantalla } from "@/app/ui";
import { contextoActual } from "@/lib/sesion";
import { preferenciasDe } from "@/dominio/preferencias/gestionar";
import { FormularioAjustes } from "@/app/ajustes-formulario";
import { SeccionDeCuenta } from "@/app/seccion-cuenta";

export const metadata = { title: "Configuración" };

/**
 * Ajustes de la cuenta de plataforma.
 *
 * Misma pantalla que la del establecimiento y el mismo guardado, recortada a lo
 * que aplica: acá no hay taquilla que ajustar. Antes esto guardaba el tema sólo
 * en una cookie, que se perdía al cambiar de equipo; ahora la preferencia es de
 * la cuenta como cualquier otra.
 */
export default async function Configuracion() {
  const contexto = await contextoActual(await headers()).catch(() => null);
  if (!contexto) redirect("/login");

  const preferencias = await preferenciasDe(contexto);

  return (
    <>
      <h1 style={{ ...tituloPantalla, margin: 0 }}>Ajustes</h1>
      <p style={{ ...textoTenue, fontSize: "14px", marginTop: "6px", maxWidth: "56em" }}>
        La apariencia la elige la persona, nunca el sistema operativo. La preferencia se guarda por
        cuenta, así que cada quien trabaja como prefiere.
      </p>

      <FormularioAjustes inicial={preferencias} soloApariencia />

      <SeccionDeCuenta />
    </>
  );
}
