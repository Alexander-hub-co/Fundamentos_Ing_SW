import { headers } from "next/headers";
import { botonTenue } from "@/app/ui";
import { BarraLateral, ConBarraLateral, type Seccion } from "@/app/barra-lateral";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { cerrarSesion } from "../(auth)/login/acciones";
import { purgarSiCorresponde } from "@/dominio/auditoria/retencion";
import { identidadVisible } from "@/dominio/cuentas/identidad";

/**
 * Guardia del panel de plataforma.
 *
 * La comprobación ocurre en el servidor antes de renderizar nada. Que la
 * interfaz no muestre un enlace no es control de acceso (FR-003): las
 * operaciones de dominio vuelven a exigir autorización por su cuenta, y esta
 * guardia sólo evita mostrar una pantalla que igualmente no funcionaría.
 */
export default async function LayoutPlataforma({
  children,
}: {
  children: React.ReactNode;
}) {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    // FR-033: la contraseña temporal debe cambiarse antes que nada.
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "plataforma") redirect("/establecimiento");

  // FR-047: la retención se comprueba al entrar al panel. Casi siempre es una
  // consulta a un índice que decide que no toca; la purga real ocurre una vez
  // al día. No lanza nunca, así que no puede tumbar esta pantalla.
  await purgarSiCorresponde();

  const quien = await identidadVisible(contexto);

  return (
    <ConBarraLateral
      barra={
        <BarraLateral
          titulo="Administración de la plataforma"
          secciones={SECCIONES}
          persona={quien}
          pie={
            <form action={cerrarSesion}>
              <button type="submit" style={botonTenue}>
                Cerrar sesión
              </button>
            </form>
          }
        />
      }
    >
      {children}
    </ConBarraLateral>
  );
}

/**
 * El menú del administrador general, según el rediseño. "Configuración" pasa a
 * llamarse "Ajustes" y lleva la tuerca: es la única iconografía del sistema, y
 * marca que esa entrada es de preferencias y no de gestión.
 */
const SECCIONES: Seccion[] = [
  { href: "/panel", texto: "Panel" },
  { href: "/parqueaderos", texto: "Parqueaderos" },
  { href: "/cuentas", texto: "Cuentas" },
  { href: "/configuracion", texto: "Ajustes", ajustes: true },
];
