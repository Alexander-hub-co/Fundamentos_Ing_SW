import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { obtenerMiParqueadero } from "@/dominio/parqueaderos/listar";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import { botonTenue, tituloPantalla } from "@/app/ui";
import { ArmazonEstablecimiento } from "../../nav";
import { CamposEstablecimiento } from "@/app/campos-establecimiento";
import { guardarMiEstablecimiento } from "./acciones";

export const metadata = { title: "Editar mi parqueadero" };

export default async function EditarMiEstablecimiento() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");

  // Pantalla de administración: el operario no entra.
  //
  // Va acá y no sólo escondiendo la entrada del menú, porque la constitución
  // es explícita (FR-003): esconder una opción NUNCA constituye control de
  // acceso. Escribiendo la dirección a mano se llegaba igual.
  //
  // Se redirige en vez de lanzar: no es un error, es que esta pantalla no es
  // suya, y la taquilla es donde sí tiene trabajo.
  if (!puede(contexto, "establecimiento.administrar.ver")) redirect("/taquilla");

  // Suspendido o dado de baja: editar la configuración es justo lo que el modo
  // restringido impide (FR-028), así que ni se ofrece la pantalla.
  if (contexto.estado !== "activo" && contexto.estado !== "pendiente") {
    redirect("/restringido");
  }

  const propio = await obtenerMiParqueadero(contexto);
  if (!propio) throw await errorDeAlcance(contexto, "parqueadero:propio");

  return (
    <ArmazonEstablecimiento>

        <Link href="/establecimiento" style={botonTenue}>
          ← Volver
        </Link>

        <h1 style={tituloPantalla}>Datos del establecimiento</h1>

        <CamposEstablecimiento
          accion={guardarMiEstablecimiento}
          volverA="/establecimiento"
          valores={{
            codigo: propio.codigo,
            nombre: propio.nombre,
            ciudad: propio.ciudad,
            direccion: propio.direccion,
            telefono: propio.telefono,
          }}
        />
    </ArmazonEstablecimiento>
  );
}
