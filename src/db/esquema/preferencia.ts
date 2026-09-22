import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { acentoVisual, densidadTaquilla, temaVisual } from "./enums";
import { usuario } from "./usuario";

/**
 * Cómo quiere ver Parquivo cada persona.
 *
 * Es de **plataforma**, no de tenencia, y por eso no lleva política RLS: la
 * preferencia es de la cuenta, no del parqueadero. Un operario que atiende dos
 * establecimientos no quiere que el tema le cambie al pasar de uno al otro.
 * Cada lectura se acota a `contexto.usuarioId`, igual que `identidadVisible`.
 *
 * La fila puede no existir: quien nunca entró a Ajustes no tiene ninguna, y
 * eso se resuelve con los valores por defecto en el dominio en vez de sembrar
 * una fila por cuenta. Un valor por defecto que vive en un solo sitio se
 * cambia una vez.
 */
export const preferenciaUsuario = pgTable(
  "preferencia_usuario",
  {
    usuarioId: text("usuario_id")
      .primaryKey()
      .references(() => usuario.id, { onDelete: "cascade" }),

    tema: temaVisual("tema").notNull(),
    acento: acentoVisual("acento").notNull(),
    densidad: densidadTaquilla("densidad").notNull(),

    /**
     * Alto del campo de placa, en píxeles. Para casetas con la pantalla lejos
     * o con poca luz.
     */
    tamanoPlaca: integer("tamano_placa").notNull(),

    /**
     * Un paso más antes de cobrar. Menos cobros por error, a cambio de un
     * clic; quien atiende fila alta suele preferir apagarlo.
     */
    confirmarCobro: boolean("confirmar_cobro").notNull().default(false),

    /**
     * Mandar el ticket a la impresora sin pulsar nada.
     *
     * Apagado de partida: hasta que se compruebe que la impresora de esa caseta
     * responde, encenderlo sólo produce diálogos. En la salida es además sólo
     * el valor de partida de la pregunta que se le hace al operario en el
     * momento.
     */
    imprimirAuto: boolean("imprimir_auto").notNull().default(false),

    /**
     * Ancho del rollo, en milímetros. Es un dato de la máquina y no del gusto
     * de la persona, pero vive acá porque la caseta suele tener una cuenta y
     * porque así se puede corregir en el momento, con el papel en la mano. Si
     * aparecen casetas compartiendo cuenta, se muda a la configuración del
     * establecimiento.
     */
    anchoRollo: integer("ancho_rollo").notNull().default(58),

    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // El rango se impone también en la base: un valor fuera de él no rompe
    // nada visible, simplemente deja la taquilla inutilizable, que es peor.
    check("preferencia_placa_legible", sql`${t.tamanoPlaca} between 40 and 96`),
    check("preferencia_rollo_conocido", sql`${t.anchoRollo} in (58, 80)`),
  ],
);

export type PreferenciaUsuario = typeof preferenciaUsuario.$inferSelect;
