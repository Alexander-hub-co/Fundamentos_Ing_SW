import { BarraLateral, ConBarraLateral, type Seccion } from "@/app/barra-lateral";
import { botonTenue } from "@/app/ui";
import { cerrarSesion } from "@/app/(auth)/login/acciones";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { identidadVisible } from "@/dominio/cuentas/identidad";

/**
 * Barra del establecimiento.
 *
 * Las nueve entradas que el rediseño define para este rol, más las que
 * aparecieron construyendo: Últimos cobros y Fichas. Reportes se agrega cuando su pantalla exista: un menú que lleva a
 * ninguna parte es peor que un menú corto.
 */
const SECCIONES: Seccion[] = [
  // La taquilla va primero: es la pantalla donde se pasa el día, y las demás se
  // visitan una vez al mes.
  { href: "/taquilla", texto: "Taquilla" },
  // Quiénes están adentro AHORA. En el computador es el panel derecho de la
  // taquilla; en el teléfono ese panel no cabe, así que la maqueta 7b le da
  // pestaña propia. La pantalla ya existía y no se llegaba a ella desde el
  // menú.
  { href: "/taquilla/adentro", texto: "Adentro ahora", textoMovil: "Adentro", soloMovil: true },
  { soloAdmin: true, href: "/establecimiento", texto: "Mi parqueadero", textoMovil: "Inicio" },
  // En el teléfono estas tres van agrupadas bajo "Config", como en la maqueta:
  // cinco columnas no admiten "Horario y capacidad" sin partirlo.
  // El rótulo dice TARIFAS y no "Config", que es lo que decía la maqueta: el
  // botón lleva a tarifas, y un rótulo que no nombra su destino hace buscar en
  // el sitio equivocado. Si algún día "Config" abre un índice de configuración,
  // vuelve el nombre.
  { href: "/configuracion/tarifas", texto: "Tarifas" },
  { soloAdmin: true, href: "/configuracion/horario", texto: "Horario y capacidad", textoMovil: "Horario" },
  { soloAdmin: true, href: "/configuracion/turnos", texto: "Turnos" },
  { href: "/configuracion/convenios", texto: "Convenios" },
  { href: "/cobros", texto: "Últimos cobros", textoMovil: "Cobros" },
  { href: "/reportes", texto: "Reportes" },
  { href: "/mis-turnos", texto: "Mis turnos", textoMovil: "Mi turno" },
  { soloAdmin: true, href: "/equipo", texto: "Operarios" },
  // Última y con engranaje, como en la maqueta: se visita poco y no compite
  // con lo que se usa a diario.
  { href: "/ajustes", texto: "Ajustes", ajustes: true },
];

export async function ArmazonEstablecimiento({
  children,
  sinRelleno = false,
}: {
  children: React.ReactNode;
  sinRelleno?: boolean;
}) {
  const contexto = await contextoActual(await headers());
  const quien = await identidadVisible(contexto);

  // El menú se recorta al rol. Ofrecerle a un operario seis entradas que lo
  // devuelven a la taquilla es peor que no ofrecérselas: parece que el sistema
  // falla, cuando lo que pasa es que esas pantallas no son suyas.
  //
  // El recorte es COMODIDAD y no seguridad. Cada una de esas pantallas
  // comprueba el permiso antes de consultar nada, porque escribir la dirección
  // a mano se puede.
  const administra = puede(contexto, "establecimiento.administrar.ver");
  const secciones = administra ? SECCIONES : SECCIONES.filter((s) => !s.soloAdmin);

  return (
    <ConBarraLateral
      barra={
        <BarraLateral
          titulo="Mi establecimiento"
          secciones={secciones}
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
      sinRelleno={sinRelleno}
    >
      {children}
    </ConBarraLateral>
  );
}
