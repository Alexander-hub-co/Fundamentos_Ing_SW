import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usuario } from "./usuario";

/**
 * Registro de intentos de inicio de sesión. Sostiene la demora progresiva
 * (FR-006, FR-007) y su auditoría (FR-008).
 *
 * Tabla de plataforma, sin política de tenencia: la alcanza únicamente la
 * conexión privilegiada, porque se consulta antes de que exista un ámbito.
 */
export const intentoLogin = pgTable(
  "intento_login",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Se guarda el correo intentado aunque no corresponda a ninguna cuenta.
     * La demora se cuenta por este campo y no por cuenta existente, para que
     * el mecanismo no revele qué correos están registrados (FR-006).
     */
    emailIntentado: text("email_intentado").notNull(),

    usuarioId: text("usuario_id").references(() => usuario.id),
    origen: text("origen"),
    exito: boolean("exito").notNull(),

    ocurridoEn: timestamp("ocurrido_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // El cálculo de la demora consulta por correo y ventana temporal.
    index("intento_login_email_fecha").on(t.emailIntentado, t.ocurridoEn),
  ],
);

/**
 * Constancia de intentos de operar fuera de ámbito (FR-005).
 *
 * Tabla de plataforma: registrar una violación de ámbito no puede depender del
 * ámbito que se acaba de violar.
 */
export const accesoDenegado = pgTable(
  "acceso_denegado",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: text("usuario_id").references(() => usuario.id),
    recurso: text("recurso").notNull(),
    parqueaderoAmbito: uuid("parqueadero_ambito"),
    ocurridoEn: timestamp("ocurrido_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("acceso_denegado_fecha").on(t.ocurridoEn)],
);

/**
 * Historial de cambios de estado de un establecimiento (FR-026).
 * Se conserva aunque el establecimiento cambie de estado después.
 */
export const cambioEstado = pgTable(
  "cambio_estado",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parqueaderoId: uuid("parqueadero_id").notNull(),
    estadoAnterior: text("estado_anterior"),
    estadoNuevo: text("estado_nuevo").notNull(),
    motivo: text("motivo").notNull(),
    ejecutadoPor: text("ejecutado_por").references(() => usuario.id),
    ocurridoEn: timestamp("ocurrido_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cambio_estado_parqueadero").on(t.parqueaderoId, t.ocurridoEn),

    /**
     * Tiene ámbito, así que lleva política.
     *
     * F1 la había eximido en la guardia de `blindaje.sql` argumentando que sólo
     * se lee con privilegio de plataforma, y era cierto. Pero `app_tenant`
     * tenía permiso sobre ella y, sin política, habría visto el historial de
     * estados de TODOS los establecimientos en cuanto alguien la consultara
     * desde `conAmbito`.
     *
     * Que hoy ningún código lo haga no es una protección: es la ausencia de
     * una. La política existe para el código que todavía no está escrito.
     *
     * Las escrituras siguen ocurriendo con `comoPlataforma`, que tiene
     * BYPASSRLS, así que anotar el cambio de estado de cualquier
     * establecimiento sigue funcionando igual.
     */
    pgPolicy("cambio_estado_ambito", {
      as: "permissive",
      for: "all",
      using: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
      withCheck: sql`parqueadero_id = nullif(current_setting('app.parqueadero_id', true), '')::uuid`,
    }),
  ],
).enableRLS();

/**
 * Ejercicios del privilegio global (escenario 4 de la historia 2).
 *
 * Que el administrador general vea todos los establecimientos es legítimo, pero
 * debe quedar visible. Se anota la operación concreta y quién la ejecutó: un
 * asiento que sólo dijera "alguien usó el privilegio" no serviría para auditar.
 *
 * No se registra la autenticación, que también atraviesa el aislamiento pero
 * ocurre en cada petición y ahogaría la señal útil bajo el ruido.
 */
export const usoPrivilegio = pgTable(
  "uso_privilegio",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: text("usuario_id").references(() => usuario.id),
    operacion: text("operacion").notNull(),
    ocurridoEn: timestamp("ocurrido_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("uso_privilegio_fecha").on(t.ocurridoEn)],
);

/** Retención de los registros que guardan datos personales (FR-047). */
export const RETENCION_MESES = 12;

/**
 * Marcas de las tareas de mantenimiento que deben ocurrir cada tanto.
 *
 * Vive en la base y no en memoria del proceso a propósito: con más de una
 * instancia, o tras un reinicio, una marca en memoria haría que la purga se
 * repitiera o no ocurriera nunca. Acá todas las instancias ven la misma.
 */
export const mantenimiento = pgTable("mantenimiento", {
  clave: text("clave").primaryKey(),
  ejecutadoEn: timestamp("ejecutado_en", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Cada cuánto se revisa la retención. */
export const HORAS_ENTRE_PURGAS = 24;
