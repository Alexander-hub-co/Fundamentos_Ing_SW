import { eq } from "drizzle-orm";
import { conAmbito } from "@/db/ambito";
import { horarioAtencion, horarioFranja } from "@/db/esquema";
import { minutosDelDia } from "@/dominio/calendario/expandir";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

export class HorarioInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "HorarioInvalido";
  }
}

export type FranjaDeclarada = {
  diaSemana: number;
  horaApertura: string;
  horaCierre: string;
};

export type DatosHorario = {
  abierto24h: boolean;
  cobraHorasCerradas: boolean;
  franjas: FranjaDeclarada[];
};

/**
 * Validación de las franjas.
 *
 * El solape se comprueba sólo entre franjas del MISMO día y que no crucen la
 * medianoche. Dos franjas que cruzan no se pueden comparar por sus horas de
 * reloj sin expandirlas, y declarar dos nocturnas el mismo día es tan raro que
 * no justifica el rodeo: si aparece el caso, la comprobación se muda a
 * instantes absolutos.
 */
function validar(datos: DatosHorario): void {
  if (datos.abierto24h) return;

  if (datos.franjas.length === 0) {
    throw new HorarioInvalido(
      "Declare al menos una franja de atención, o marque el establecimiento como abierto 24 horas",
    );
  }

  for (const f of datos.franjas) {
    if (f.diaSemana < 0 || f.diaSemana > 6) {
      throw new HorarioInvalido("Día de la semana inválido");
    }
    if (minutosDelDia(f.horaApertura) === minutosDelDia(f.horaCierre)) {
      throw new HorarioInvalido(
        "La hora de cierre no puede ser igual a la de apertura: no expresa ninguna duración",
      );
    }
  }

  for (let dia = 0; dia <= 6; dia++) {
    const delDia = datos.franjas
      .filter((f) => f.diaSemana === dia)
      .map((f) => ({ ini: minutosDelDia(f.horaApertura), fin: minutosDelDia(f.horaCierre) }))
      .filter((f) => f.fin > f.ini)
      .sort((a, b) => a.ini - b.ini);

    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i]!.ini < delDia[i - 1]!.fin) {
        throw new HorarioInvalido("Hay dos franjas que se solapan el mismo día");
      }
    }
  }
}

/**
 * Declara el horario de atención (FR-018 a FR-022).
 *
 * Reemplaza el anterior entero: el horario no se versiona —sólo las tarifas lo
 * hacen—, porque un movimiento pasado se reconstruye con la tarifa que regía y
 * ésta guarda su propia vigencia.
 *
 * ATENCIÓN: esto cambia cómo se cobra. La jornada tarifaria se apoya en el
 * horario, así que editarlo altera el importe de los vehículos que ya están
 * adentro. La pantalla lo advierte; qué hacer con los movimientos en curso lo
 * decide F3, que es cuando existirán.
 */
export async function declararHorario(
  contexto: Contexto,
  datos: DatosHorario,
): Promise<void> {
  exigir(contexto, "parqueadero.editar.propio");
  validar(datos);

  if (contexto.tipo !== "establecimiento") {
    throw new HorarioInvalido("El contexto no pertenece a ningún establecimiento");
  }

  const parqueaderoId = contexto.parqueaderoId;

  await conAmbito(parqueaderoId, async (tx) => {
    const [existente] = await tx.select().from(horarioAtencion).limit(1);

    const cabecera = existente
      ? (
          await tx
            .update(horarioAtencion)
            .set({
              abierto24h: datos.abierto24h,
              cobraHorasCerradas: datos.cobraHorasCerradas,
            })
            .where(eq(horarioAtencion.id, existente.id))
            .returning()
        )[0]!
      : (
          await tx
            .insert(horarioAtencion)
            .values({
              parqueaderoId,
              abierto24h: datos.abierto24h,
              cobraHorasCerradas: datos.cobraHorasCerradas,
            })
            .returning()
        )[0]!;

    await tx.delete(horarioFranja).where(eq(horarioFranja.horarioId, cabecera.id));

    if (!datos.abierto24h && datos.franjas.length > 0) {
      await tx.insert(horarioFranja).values(
        datos.franjas.map((f) => ({
          horarioId: cabecera.id,
          parqueaderoId,
          diaSemana: f.diaSemana,
          horaApertura: f.horaApertura,
          horaCierre: f.horaCierre,
        })),
      );
    }
  });
}
