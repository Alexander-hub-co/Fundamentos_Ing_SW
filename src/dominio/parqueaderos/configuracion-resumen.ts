import type { Contexto } from "@/lib/sesion";
import { comoEstablecimiento } from "@/dominio/configuracion/como-plataforma";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { tarifasVigentes } from "@/dominio/tarifas/consultar";
import { conveniosDelEstablecimiento } from "@/dominio/convenios/gestionar";
import { capacidadDeclarada } from "@/dominio/capacidad/declarar";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";

export type ResumenConfiguracion = {
  horario: string;
  tarifas: string;
  convenios: string;
  capacidad: string;
};

const ABREVIATURA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/**
 * Lo que el administrador general ve de la configuración de un establecimiento.
 *
 * Es sólo lectura y a propósito: la configuración la declara el administrador
 * del local, y esta pantalla existe para saber en qué estado la tiene —no para
 * cambiarla desde aquí—. Por eso devuelve frases ya armadas y no los datos
 * crudos: quien mira quiere saber "sí, tiene tarifas" o "no, le faltan", no
 * auditar cada valor.
 *
 * La lectura pasa por `comoEstablecimiento`, que es la única puerta que existe
 * para que la plataforma toque datos de un local. No se duplica ni una consulta:
 * se llaman las mismas cuatro funciones que usa el propio establecimiento, con
 * un contexto acotado al suyo. Eso deja además el asiento de auditoría, que es
 * lo correcto: mirar la configuración ajena es un uso de privilegio.
 */
export async function resumenDeConfiguracion(
  contexto: Contexto,
  parqueaderoId: string,
): Promise<ResumenConfiguracion> {
  const local = await comoEstablecimiento(contexto, parqueaderoId, "ver_configuracion");

  const [horario, tarifas, convenios, capacidad] = await Promise.all([
    horarioDelCobro(local),
    tarifasVigentes(local),
    conveniosDelEstablecimiento(local),
    capacidadDeclarada(local),
  ]);

  const ahora = new Date();
  const vigentes = convenios.filter(
    (c) => c.activo && (c.hasta === null || c.hasta > ahora),
  ).length;
  const cupos = capacidad.reduce((suma, c) => suma + c.capacidad.cupos, 0);

  return {
    horario: describirHorario(horario),
    tarifas:
      tarifas.length === 0
        ? "Sin declarar"
        : `${tarifas.length} ${tarifas.length === 1 ? "tipo declarado" : "tipos declarados"}`,
    convenios:
      vigentes === 0
        ? "Ninguno vigente"
        : `${vigentes} ${vigentes === 1 ? "vigente" : "vigentes"}`,
    capacidad:
      capacidad.length === 0
        ? "Sin declarar"
        : `${cupos} ${cupos === 1 ? "cupo" : "cupos"}`,
  };
}

/**
 * El horario en una línea.
 *
 * Cuando todas las franjas abren y cierran a la misma hora —el caso normal— se
 * dice esa hora y qué días. Cuando no, no se intenta resumir: se remite a la
 * pantalla del horario. Un resumen que miente sobre una excepción es peor que
 * no resumir.
 */
export function describirHorario(h: HorarioDelCobro): string {
  if (h.abierto24h) return "Abierto 24 horas";

  const [primera, ...resto] = h.franjas;
  if (!primera) return "Sin declarar";

  const parejo = resto.every(
    (f) => f.horaInicio === primera.horaInicio && f.horaFin === primera.horaFin,
  );

  const dias = describirDias([...new Set(h.franjas.map((f) => f.diaSemana))].sort((a, b) => a - b));

  return parejo ? `${hhmm(primera.horaInicio)}–${hhmm(primera.horaFin)}, ${dias}` : `Propio, ${dias}`;
}

/** `07:00:00` de PostgreSQL se muestra como `07:00`; los segundos no aportan. */
const hhmm = (t: string) => t.slice(0, 5);

function describirDias(dias: number[]): string {
  const abrev = (d: number) => ABREVIATURA[d] ?? String(d);

  const primero = dias[0];
  const ultimo = dias[dias.length - 1];
  if (primero === undefined || ultimo === undefined) return "sin días";
  if (dias.length === 7) return "todos los días";
  if (dias.length === 1) return abrev(primero);

  // Un tramo corrido se dice "lun a sáb". Se comprueba de verdad que no falte
  // ninguno en el medio: "lun a sáb" cuando el miércoles está cerrado sería
  // información falsa, no un redondeo.
  const corrido = ultimo - primero + 1 === dias.length;
  return corrido ? `${abrev(primero)} a ${abrev(ultimo)}` : dias.map(abrev).join(", ");
}
