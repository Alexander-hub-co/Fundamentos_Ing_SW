import Link from "next/link";
import { cifra } from "@/app/ui";
import { PantallaDeAviso, accionPrincipal, accionSecundaria } from "@/app/pantalla-aviso";

export const metadata = { title: "Página no encontrada" };

/**
 * 404 (maqueta 11a).
 *
 * El texto dice algo que en este producto no es relleno: **nada se perdió**. Un
 * parqueadero dado de baja, una cuenta anonimizada o un convenio vencido siguen
 * existiendo —el Principio IV no deja destruir historial— y sólo cambiaron de
 * estado. Quien llega aquí desde un enlace viejo necesita saber eso antes que
 * cualquier otra cosa, porque lo primero que teme es haber borrado algo.
 *
 * Las dos salidas no distinguen rol: esta pantalla la ve cualquiera, incluso
 * sin sesión, y comprobar la sesión para elegir el destino la volvería dinámica
 * a cambio de nada. Los dos enlaces llevan a sitios que redirigen bien solos.
 */
export default function NoEncontrada() {
  return (
    <PantallaDeAviso
      ancho={520}
      acciones={
        <>
          <Link href="/" style={accionPrincipal}>
            Volver al panel
          </Link>
          <Link href="/taquilla" style={accionSecundaria}>
            Ir a la taquilla
          </Link>
        </>
      }
    >
      <div>
        <div
          style={{
            ...cifra,
            fontSize: "78px",
            fontWeight: 800,
            lineHeight: 1,
            color: "var(--borde)",
          }}
        >
          404
        </div>
        <h1 style={{ margin: "14px 0 8px", fontSize: "24px", fontWeight: 800 }}>
          Esta página no existe
        </h1>
        <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6, color: "var(--texto-tenue)" }}>
          La dirección puede estar mal escrita, o el elemento que buscaba fue dado de baja. Nada
          se perdió: el historial no se destruye, sólo cambia de estado.
        </p>
      </div>
    </PantallaDeAviso>
  );
}
