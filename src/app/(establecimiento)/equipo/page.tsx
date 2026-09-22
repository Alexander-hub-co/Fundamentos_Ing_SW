import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { miEquipo } from "@/dominio/cuentas/en-establecimiento";
import { ArmazonEstablecimiento } from "../nav";
import { PanelEquipo } from "./panel";
import { delegacionesVigentes } from "@/dominio/correcciones/emitir";
import { desempenoDelEquipo } from "@/dominio/reportes/equipo";

export const metadata = { title: "Operarios" };

export default async function PaginaEquipo() {
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
  if (contexto.estado !== "activo" && contexto.estado !== "pendiente") redirect("/restringido");

  const [equipo, delegaciones, desempeno] = await Promise.all([
    miEquipo(contexto),
    delegacionesVigentes(contexto),
    desempenoDelEquipo(contexto),
  ]);

  // Se componen acá y no en una consulta sola porque responden preguntas
  // distintas: quién trabaja acá, y cuánto vendió. Toda pantalla que sólo
  // quiera la lista no debería pagar las agregaciones.
  const conDesempeno = equipo.map((m) => ({
    ...m,
    vendido: desempeno.get(m.id)?.vendido ?? 0,
    turnos: desempeno.get(m.id)?.turnos ?? [],
    enTurno: desempeno.get(m.id)?.enTurno ?? false,
  }));

  return (
    <ArmazonEstablecimiento>
      {/* Título y subtítulo los dibuja el panel: el botón de alta va en la
          misma línea del título y necesita el estado del cliente. */}
      <PanelEquipo
        equipo={conDesempeno}
        yo={contexto.usuarioId}
        esAdministrador={contexto.rol === "admin_parqueadero"}
        puedenCorregir={[...delegaciones.entries()]
          .filter(([, ops]) => ops.includes("emitir_correccion"))
          .map(([id]) => id)}
      />
    </ArmazonEstablecimiento>
  );
}