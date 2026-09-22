import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { conAmbito } from "@/db/ambito";
import { asignacion, usuario } from "@/db/esquema";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { turnosDelEstablecimiento } from "@/dominio/turnos/consultar";
import { horasSinCubrir } from "@/dominio/turnos/cobertura";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { ArmazonEstablecimiento } from "@/app/(establecimiento)/nav";
import { PanelTurnos } from "./panel";

export const metadata = { title: "Turnos" };

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Lunes de la semana en curso, en hora local, para calcular la cobertura. */
function inicioDeSemana(ahora: Date): Date {
  const local = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() - local.getDay());
  return local;
}

export default async function PaginaTurnos() {
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

  const [turnos, horario] = await Promise.all([
    turnosDelEstablecimiento(contexto),
    horarioDelCobro(contexto),
  ]);

  // La gente del establecimiento sale con RLS puesta, así que sólo aparece la
  // propia: no hace falta filtrar por parqueadero a mano.
  const gente = await conAmbito(contexto.parqueaderoId, (tx) =>
    tx
      .select({ id: usuario.id, nombre: usuario.name, codigo: usuario.codigo })
      .from(asignacion)
      .innerJoin(usuario, eq(usuario.id, asignacion.usuarioId))
      .orderBy(asc(usuario.codigo)),
  );

  const desde = inicioDeSemana(new Date());
  const huecos = horasSinCubrir(
    horario,
    turnos,
    desde,
    new Date(desde.getTime() + 7 * 24 * 3_600_000),
  );

  // Los huecos se redactan aquí, en el servidor, y viajan ya escritos. La
  // pantalla los muestra junto al botón de alta, cuyo estado es de cliente; si
  // el texto se armara allá, la hora se formatearía con la configuración
  // regional del navegador y no con la del establecimiento.
  const sinCubrir = huecos.slice(0, 8).map(
    (h) =>
      `${DIAS[h.desde.getDay()]} de ${hora(h.desde)} a ${hora(h.hasta)}`,
  );

  return (
    <ArmazonEstablecimiento>
      <PanelTurnos
        turnos={turnos}
        gente={gente}
        sinCubrir={sinCubrir}
        huecosDeMas={Math.max(0, huecos.length - sinCubrir.length)}
      />
    </ArmazonEstablecimiento>
  );
}

const hora = (d: Date) =>
  d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
