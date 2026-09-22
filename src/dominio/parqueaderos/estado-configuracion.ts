import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { horarioDelCobro, horarioDeclarado } from "@/dominio/horarios/consultar";
import { tarifasVigentes, tiposSinTarifa, catalogoDeTipos } from "@/dominio/tarifas/consultar";
import { capacidadDeclarada } from "@/dominio/capacidad/declarar";
import { conveniosDelEstablecimiento } from "@/dominio/convenios/gestionar";
import { turnosDelEstablecimiento } from "@/dominio/turnos/consultar";
import { ocupacionActual } from "@/dominio/taquilla/ocupacion";
import { describirHorario } from "./configuracion-resumen";

/**
 * En qué estado tiene su propia configuración el establecimiento.
 *
 * Hermano de `resumenDeConfiguracion`, que es el que ve la plataforma, y a
 * propósito distinto en dos cosas. Aquél pasa por la puerta de soporte y deja
 * asiento de auditoría, porque mirar datos ajenos es un uso de privilegio;
 * éste lo pide el dueño sobre lo suyo y va derecho. Y aquél sólo describe,
 * mientras que éste además lleva a cada pantalla: quien está terminando de
 * configurar su parqueadero necesita el camino, no sólo el diagnóstico.
 *
 * Tampoco consulta ninguna tabla por su cuenta. Compone las mismas funciones
 * que usan las pantallas de configuración, así que un cambio en la regla de
 * qué tarifa está vigente no deja este resumen diciendo otra cosa.
 */
export type LineaDeConfiguracion = {
  rotulo: string;
  resumen: string;
  href: string;
};

export type EstadoConfiguracion = {
  lineas: LineaDeConfiguracion[];
  /** Lo que falta, dicho con su consecuencia. Vacío cuando no falta nada. */
  pendientes: string[];
};

export async function estadoDeConfiguracion(contexto: Contexto): Promise<EstadoConfiguracion> {
  exigir(contexto, "parqueadero.ver.propio");
  if (contexto.tipo !== "establecimiento") return { lineas: [], pendientes: [] };

  const [horario, declarado, tarifas, catalogo, sinTarifa, cupos, convenios, turnos, ocupacion] =
    await Promise.all([
      horarioDelCobro(contexto),
      horarioDeclarado(contexto),
      tarifasVigentes(contexto),
      catalogoDeTipos(),
      tiposSinTarifa(contexto),
      capacidadDeclarada(contexto),
      conveniosDelEstablecimiento(contexto),
      turnosDelEstablecimiento(contexto),
      ocupacionActual(contexto),
    ]);

  const ahora = new Date();
  const vigentes = convenios.filter((c) => c.activo && (c.hasta === null || c.hasta > ahora)).length;
  const vencidos = convenios.length - vigentes;
  const turnosSinGente = turnos.filter((t) => t.activo && t.personas.length === 0).length;

  const lineas: LineaDeConfiguracion[] = [
    {
      rotulo: "Horario",
      resumen: declarado ? describirHorario(horario) : "Sin declarar",
      href: "/configuracion/horario",
    },
    {
      rotulo: "Tarifas",
      resumen:
        catalogo.length === 0
          ? "Sin catálogo"
          : `${tarifas.length} de ${catalogo.length} tipos declarados`,
      href: "/configuracion/tarifas",
    },
    {
      rotulo: "Capacidad",
      resumen:
        ocupacion.cupos === null
          ? `Sin declarar · ${ocupacion.total} adentro`
          : `${ocupacion.cupos} cupos · ${ocupacion.total} ocupados`,
      href: "/configuracion/horario",
    },
    {
      rotulo: "Turnos",
      resumen:
        turnos.length === 0
          ? "Ninguno declarado"
          : `${turnos.length} declarados${turnosSinGente > 0 ? ` · ${turnosSinGente} sin gente` : ""}`,
      href: "/configuracion/turnos",
    },
    {
      rotulo: "Convenios",
      resumen:
        convenios.length === 0
          ? "Ninguno"
          : `${vigentes} ${vigentes === 1 ? "vigente" : "vigentes"}${vencidos > 0 ? ` · ${vencidos} vencido${vencidos === 1 ? "" : "s"}` : ""}`,
      href: "/configuracion/convenios",
    },
  ];

  /**
   * Los pendientes se redactan con su CONSECUENCIA, no como casillas por
   * marcar. "Bicicleta no tiene tarifa" no le dice nada a quien no sabe qué
   * pasa entonces; "la taquilla no puede cobrar ese tipo" sí, y es lo que
   * decide si hay que ir a arreglarlo antes de abrir.
   */
  const pendientes: string[] = [];

  for (const t of sinTarifa) {
    pendientes.push(
      `${t.nombre} no tiene tarifa. Mientras no la tenga, la taquilla no puede cobrar ese tipo de vehículo.`,
    );
  }

  if (!declarado) {
    pendientes.push(
      "No hay horario declarado. El cobro se calcula como si abriera las veinticuatro horas, que puede no ser lo que usted cobra.",
    );
  }

  if (cupos.length === 0) {
    pendientes.push(
      "No hay capacidad declarada. La taquilla no puede avisar cuando el parqueadero se llena.",
    );
  }

  return { lineas, pendientes };
}
