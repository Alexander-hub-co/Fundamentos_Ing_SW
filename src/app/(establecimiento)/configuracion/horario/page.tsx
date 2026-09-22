import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { capacidadDeclarada } from "@/dominio/capacidad/declarar";
import { catalogoDeTipos } from "@/dominio/tarifas/consultar";
import { rotuloSeccionSuelto, tituloPantalla } from "@/app/ui";
import { ArmazonEstablecimiento } from "@/app/(establecimiento)/nav";
import { FormularioHorario } from "./formulario";
import { Capacidad } from "./capacidad";

export const metadata = { title: "Horario y capacidad" };

/**
 * Horario y capacidad comparten pantalla porque son la misma pregunta del
 * negocio —cuándo abre y cuánto cabe— y una sola historia de usuario. Separarlas
 * obligaría a ir y volver para dejar el establecimiento listo.
 */
export default async function PaginaHorario() {
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

  const [horario, capacidad, tipos] = await Promise.all([
    horarioDelCobro(contexto),
    capacidadDeclarada(contexto),
    catalogoDeTipos(),
  ]);

  const cuposPorTipo = Object.fromEntries(capacidad.map((c) => [c.tipo.id, c.capacidad.cupos]));

  return (
    <ArmazonEstablecimiento>
      <header style={cabecera}>
        <h1 style={{ ...tituloPantalla, margin: 0 }}>Horario y capacidad</h1>
        <p style={introduccion}>
          Un día sin marcar está cerrado. Si la hora de cierre es menor que la de apertura, el
          horario cruza la medianoche.
        </p>
      </header>

      {/* El aviso que exige la especificación: esto no es un dato de vitrina.
          Se queda pese a no estar en la maqueta, porque cambiar el horario le
          cambia el importe a vehículos que ya están adentro y quien lo edita
          tiene que saberlo antes de guardar, no después. */}
      <p style={advertencia}>
        <strong style={{ color: "var(--texto)" }}>El horario cambia lo que se cobra.</strong> La
        tarifa plena se aplica por jornada, y la jornada va de la apertura al cierre. Si este
        parqueadero no cobra las horas cerradas, el tiempo entre el cierre y la apertura siguiente
        no se cobra.
      </p>

      <div style={columnas}>
        <FormularioHorario
          abierto24h={horario.abierto24h}
          cobraHorasCerradas={horario.cobraHorasCerradas}
          franjas={horario.franjas.map((f) => ({
            diaSemana: f.diaSemana,
            horaApertura: f.horaInicio,
            horaCierre: f.horaFin,
          }))}
        />

        <section>
          <h2 className="rotulo-filete" style={rotuloSeccionSuelto}>Capacidad</h2>
          <Capacidad tipos={tipos} cuposPorTipo={cuposPorTipo} />
        </section>
      </div>

      {/* La maqueta pone aquí un panel de "Ocupación de hoy". No se dibuja:
          contar lo que hay adentro exige movimientos, y esos llegan con la
          taquilla. Un panel con ceros fijos parecería un parqueadero vacío en
          vez de una función que todavía no existe. */}
    </ArmazonEstablecimiento>
  );
}

const cabecera: React.CSSProperties = {
  paddingBottom: "22px",
  marginBottom: "26px",
  borderBottom: "1px solid var(--borde)",
};

const introduccion: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "14px",
  color: "var(--texto-tenue)",
  maxWidth: "52em",
};

/**
 * El aviso que exige la especificación.
 *
 * Ni recuadro ni regla en el canto: texto. Lo que lo hace notar es la primera
 * frase en negrita y del color del texto normal, sobre un párrafo tenue —el
 * contraste de peso basta—. Encerrarlo lo convertía en un bloque más, y una
 * línea al lado es una caja a medias.
 */
const advertencia: React.CSSProperties = {
  margin: "0 0 40px",
  fontSize: "14px",
  lineHeight: 1.6,
  color: "var(--texto-tenue)",
  maxWidth: "52em",
};

const columnas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
  gap: "48px",
  alignItems: "start",
};
