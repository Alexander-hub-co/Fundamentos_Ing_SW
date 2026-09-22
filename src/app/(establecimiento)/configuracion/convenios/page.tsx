import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { conveniosDelEstablecimiento } from "@/dominio/convenios/gestionar";
import { politicaDeCobro } from "@/dominio/cobro/politica";
import { catalogoDeTipos } from "@/dominio/tarifas/consultar";
import { Comprobador } from "./comprobador";
import { Redondeo } from "./redondeo";
import { rotuloSeccion, textoTenue } from "@/app/ui";
import { ArmazonEstablecimiento } from "../../nav";
import { usoDeConveniosEsteMes } from "@/dominio/reportes/convenios";
import { Consulta, PanelConvenios } from "./panel";

export const metadata = { title: "Convenios" };

export default async function PaginaConvenios() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado !== "activo" && contexto.estado !== "pendiente") redirect("/restringido");

  const [convenios, tipos, redondeo, uso] = await Promise.all([
    conveniosDelEstablecimiento(contexto),
    catalogoDeTipos(),
    politicaDeCobro(contexto),
    usoDeConveniosEsteMes(contexto),
  ]);

  // Sólo los vigentes se pueden comprobar: probar con uno vencido daría un
  // número que la taquilla nunca va a cobrar.
  const ahora = new Date();
  const comprobables = convenios
    .filter((c) => c.activo && (c.hasta === null || c.hasta > ahora))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      activacion: c.activacion,
      descripcion: c.descripcion,
    }));

  // Un operario ve esta pantalla, pero de sólo lectura: qué convenios están
  // vigentes y qué hace cada uno, que es lo que necesita para responderle a un
  // cliente. Ni las herramientas de comprobación ni el ajuste de redondeo, que
  // son de administración.
  const administra = puede(contexto, "establecimiento.administrar.ver");

  return (
    <ArmazonEstablecimiento>
      {/* El orden lo decide lo que se viene a hacer.
          Antes abría el REDONDEO —un ajuste que se toca una vez al año— y la
          lista de convenios quedaba tercera, debajo de dos herramientas de
          consulta separadas entre sí. Ahora: los convenios, luego declarar uno,
          luego comprobar, y el ajuste al final. */}
      {/* Título y subtítulo los dibuja el panel: el botón de "Nuevo convenio"
          va en la misma línea del título y necesita el estado del cliente. */}
      <PanelConvenios convenios={convenios} uso={uso} administra={administra} />

      {administra && (
      <section style={{ marginTop: "52px" }}>
        <h2 className="rotulo-filete" style={rotuloSeccion}>
          Comprobar antes de prometer
        </h2>
        <p style={{ ...textoTenue, margin: "0 0 22px", maxWidth: "52em" }}>
          Las dos preguntas que se hacen con un cliente delante: si una placa tiene convenio, y
          cuánto pagaría de verdad con él aplicado.
        </p>
        <Consulta />
        <Comprobador tipos={tipos} convenios={comprobables} />
      </section>
      )}

      {administra && (
        <section style={{ marginTop: "52px" }}>
          <Redondeo actual={redondeo} />
        </section>
      )}
    </ArmazonEstablecimiento>
  );
}

