import Link from "next/link";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";
import { obtenerDetalleParqueadero } from "@/dominio/parqueaderos/detalle";
import { botonTenue, tituloPantalla } from "@/app/ui";
import { CamposEstablecimiento } from "@/app/campos-establecimiento";
import { guardarEstablecimiento } from "./acciones";

export const metadata = { title: "Editar establecimiento" };

export default async function EditarEstablecimiento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contexto = await contextoActual(await headers());
  const detalle = await obtenerDetalleParqueadero(contexto, id);

  if (!detalle) throw await errorDeAlcance(contexto, `parqueadero:${id}`);

  const p = detalle.parqueadero;

  return (
    <>
      <Link href={`/parqueaderos/${id}`} style={botonTenue}>
        ← Volver a la ficha
      </Link>

      <h1 style={tituloPantalla}>Editar {p.nombre}</h1>

      <CamposEstablecimiento
        accion={guardarEstablecimiento}
        volverA={`/parqueaderos/${id}`}
        valores={{
          codigo: p.codigo,
          nombre: p.nombre,
          ciudad: p.ciudad,
          direccion: p.direccion,
          telefono: p.telefono,
        }}
        campoOculto={{ nombre: "id", valor: id }}
      />
    </>
  );
}
