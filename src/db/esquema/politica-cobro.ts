import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { parqueadero } from "./parqueadero";
import { reglaRedondeo } from "./enums";

/**
 * Cómo cobra un establecimiento, más allá de sus tarifas.
 *
 * Hoy lleva una sola decisión —cómo redondea— y aun así tiene tabla propia. No
 * va en `parqueadero` porque esa tabla la administra la plataforma: nombre,
 * dirección, estado de suscripción. El redondeo lo decide el local. Y no va en
 * `horario_atencion`, aunque allí ya viva `cobra_horas_cerradas`, porque el
 * horario puede no declararse nunca y el redondeo tiene que existir siempre;
 * colgarlo de allí dejaría sin regla a quien no declaró horario.
 *
 * A lo sumo una fila por establecimiento. La AUSENCIA de fila significa el
 * valor inicial, igual que un establecimiento sin horario se trata como abierto
 * veinticuatro horas. Eso evita crear filas al dar de alta un parqueadero y
 * evita la rama "¿y si falta?" desperdigada por el código: se resuelve una vez,
 * en la lectura.
 */
export const politicaCobro = pgTable(
  "politica_cobro",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    parqueaderoId: uuid("parqueadero_id")
      .notNull()
      .unique()
      .references(() => parqueadero.id),

    redondeo: reglaRedondeo("redondeo").notNull(),


    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    pgPolicy("politica_cobro_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
  ],
).enableRLS();

export type PoliticaCobro = typeof politicaCobro.$inferSelect;
