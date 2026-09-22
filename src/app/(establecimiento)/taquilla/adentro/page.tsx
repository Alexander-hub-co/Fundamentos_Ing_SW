import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { ocupacionActual, vehiculosAdentro } from "@/dominio/taquilla/ocupacion";
import { botonMenudo } from "@/app/ui";
import { ArmazonEstablecimiento } from "../../nav";
import { Adentro } from "../adentro";

export const metadata = { title: "Adentro ahora" };

/**
 * Quién está adentro, como pantalla propia.
 *
 * En el computador esto es la columna derecha de la taquilla. En un celular no
 * caben las dos cosas, y la maqueta móvil lo resuelve dándole su propia
 * pantalla en lugar de apretujarlas.
 *
 * La ruta existe SIEMPRE, no sólo en móvil: una dirección que aparece y
 * desaparece según el ancho de la ventana es una dirección que no se puede
 * compartir ni marcar. En pantalla ancha simplemente no hace falta ir hasta
 * aquí, porque la información ya está al lado.
 */
export default async function PaginaAdentro() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado === "dado_de_baja") redirect("/restringido");

  const ahora = new Date();
  const [ocupacion, adentro] = await Promise.all([
    ocupacionActual(contexto),
    vehiculosAdentro(contexto),
  ]);

  const porcentaje =
    ocupacion.cupos && ocupacion.cupos > 0
      ? Math.round((ocupacion.total / ocupacion.cupos) * 100)
      : null;

  return (
    <ArmazonEstablecimiento sinRelleno>
      <div className="toque" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        <div style={cabecera}>
          <Link href="/taquilla" style={botonMenudo}>
            ← Taquilla
          </Link>
          {porcentaje !== null && (
            <span style={{ marginLeft: "auto", fontSize: "13px", color: "var(--texto-tenue)" }}>
              ocupación {porcentaje} %
            </span>
          )}
        </div>

        {/* Sólo quiénes están adentro AHORA. Lo que ya salió tiene su propia
            pantalla, "Últimos cobros", donde además se corrige. */}
        <Adentro ocupacion={ocupacion} vehiculos={adentro} ahora={ahora} />

      </div>
    </ArmazonEstablecimiento>
  );
}

const cabecera: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "16px 22px 0",
};
