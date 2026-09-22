import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { correccion, movimiento } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { rotuloDe } from "@/dominio/taquilla/rotulo";

/**
 * Los cobros ya cerrados, por período.
 *
 * Sale de la taquilla a propósito. Antes vivían al lado del campo de placa, y
 * ahí competían con lo único que quien atiende necesita mirar con fila. La
 * taquilla se queda con quién está ADENTRO ahora; lo que ya salió se consulta
 * cuando hay tiempo, que es cuando de verdad se revisa la caja.
 *
 * **Un operario ve sólo lo suyo, y no es una cortesía.** Un operario que puede
 * ver los cobros de sus compañeros puede comparar cajas, y eso no es asunto
 * suyo. Ve lo que él cobró, que es lo que necesita para cuadrar su turno.
 */

export type Periodo = "hoy" | "mes" | "semestre";

export const PERIODOS: { valor: Periodo; titulo: string; detalle: string }[] = [
  { valor: "hoy", titulo: "Hoy", detalle: "desde las 00:00" },
  { valor: "mes", titulo: "Este mes", detalle: "desde el día 1" },
  { valor: "semestre", titulo: "Últimos 6 meses", detalle: "medio año hacia atrás" },
];

export type CobroDelPeriodo = {
  id: string;
  codigo: string;
  /** La placa, o "Ficha 7" si fue una bicicleta. */
  rotulo: string;
  tipoNombre: string;
  entradaEn: Date;
  salidaEn: Date;
  importe: number;
  cortesiaMotivo: string | null;
  corregidoA: number | null;
};

export type ResumenCobros = {
  periodo: Periodo;
  desde: Date;
  cobros: CobroDelPeriodo[];
  /** Suma de lo efectivamente cobrado, con las correcciones ya aplicadas. */
  total: number;
  /** Cuántos salieron sin cobro, y cuánto se dejó de cobrar. */
  cortesias: { cuantas: number; omitido: number };
  /** Verdadero cuando quien mira sólo ve lo suyo. */
  soloMios: boolean;
};

/**
 * Desde cuándo cuenta cada período.
 *
 * En la zona del establecimiento y no en la del servidor: sin eso, un cobro de
 * las nueve de la noche contaría en el día siguiente, y el operario que cuadra
 * su caja a las diez no lo encontraría.
 */
export function inicioDe(periodo: Periodo, ahora: Date): Date {
  const bogota = new Date(ahora.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const desfase = ahora.getTime() - bogota.getTime();

  const inicio = new Date(bogota);
  inicio.setHours(0, 0, 0, 0);

  if (periodo === "mes") inicio.setDate(1);
  if (periodo === "semestre") {
    inicio.setDate(1);
    inicio.setMonth(inicio.getMonth() - 5);
  }

  return new Date(inicio.getTime() + desfase);
}

export async function cobrosDelPeriodo(
  contexto: Contexto,
  periodo: Periodo,
  ahora: Date = new Date(),
): Promise<ResumenCobros> {
  exigir(contexto, "taquilla.consultar");

  const desde = inicioDe(periodo, ahora);
  const vacio: ResumenCobros = {
    periodo,
    desde,
    cobros: [],
    total: 0,
    cortesias: { cuantas: 0, omitido: 0 },
    soloMios: false,
  };

  if (contexto.tipo !== "establecimiento") return vacio;

  // El operario ve lo que él cobró; el administrador, todo el establecimiento.
  const soloMios = contexto.rol === "operario";

  return conAmbito(contexto.parqueaderoId, async (tx) => {
    const filas = await tx
      .select({
        id: movimiento.id,
        codigo: movimiento.codigo,
        placa: movimiento.placa,
        fichaNumero: movimiento.fichaNumero,
        tipoNombre: sql<string>`(select nombre from tipo_vehiculo where id = ${movimiento.tipoVehiculoId})`,
        entradaEn: movimiento.entradaEn,
        salidaEn: movimiento.salidaEn,
        importe: movimiento.importe,
        cortesiaMotivo: movimiento.cortesiaMotivo,
        cortesiaImporteOmitido: movimiento.cortesiaImporteOmitido,
      })
      .from(movimiento)
      .where(
        and(
          isNotNull(movimiento.salidaEn),
          gte(movimiento.salidaEn, desde),
          soloMios ? eq(movimiento.operarioSalida, contexto.usuarioId) : undefined,
        ),
      )
      .orderBy(desc(movimiento.salidaEn));

    const corregidos = await tx
      .select({ movimientoId: correccion.movimientoId, importe: correccion.importeCorregido })
      .from(correccion)
      .orderBy(desc(correccion.emitidaEn));

    // La más reciente manda: un movimiento puede corregirse más de una vez.
    const ultimaCorreccion = new Map<string, number>();
    for (const c of corregidos) {
      if (!ultimaCorreccion.has(c.movimientoId)) ultimaCorreccion.set(c.movimientoId, c.importe);
    }

    const cobros: CobroDelPeriodo[] = filas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      rotulo: rotuloDe({ placa: f.placa, fichaNumero: f.fichaNumero }),
      tipoNombre: f.tipoNombre ?? "—",
      entradaEn: f.entradaEn,
      salidaEn: f.salidaEn!,
      importe: f.importe ?? 0,
      cortesiaMotivo: f.cortesiaMotivo,
      corregidoA: ultimaCorreccion.get(f.id) ?? null,
    }));

    // Se suma lo CORREGIDO cuando existe, no lo original: el total tiene que
    // cuadrar con la caja, y en la caja está lo que se cobró de verdad.
    const total = cobros.reduce((suma, c) => suma + (c.corregidoA ?? c.importe), 0);

    const conCortesia = filas.filter((f) => f.cortesiaMotivo !== null);

    return {
      periodo,
      desde,
      cobros,
      total,
      cortesias: {
        cuantas: conCortesia.length,
        omitido: conCortesia.reduce((s, f) => s + (f.cortesiaImporteOmitido ?? 0), 0),
      },
      soloMios,
    };
  });
}
