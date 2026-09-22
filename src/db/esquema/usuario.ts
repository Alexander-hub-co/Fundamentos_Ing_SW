import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tablas de Better Auth, extendidas con los campos que exige la especificación.
 *
 * Ámbito deliberado: son tablas **de plataforma**, no de tenencia, y por eso no
 * llevan política RLS. La razón es estructural — la autenticación ocurre antes
 * de que exista un ámbito: para resolver un correo a una cuenta hay que
 * consultar sin saber todavía a qué parqueadero pertenece.
 *
 * Es la única excepción legítima al Principio I, y por eso está acotada: sólo
 * el módulo de autenticación las alcanza, mediante `comoPlataforma`.
 */
export const usuario = pgTable("user", {
  id: text("id").primaryKey(),

  /** Campo personal — se anonimiza (FR-043). */
  name: text("name").notNull(),
  /** Campo personal e identificador de inicio de sesión — se anonimiza. */
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  /** Campo personal — se anonimiza. */
  image: text("image"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  // --- Plugin de administración de Better Auth ---
  role: text("role"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),

  // --- Campos propios de Parquivo ---

  /**
   * Código legible de la cuenta: `PCH-001`, con la sigla del establecimiento.
   *
   * Es un identificador de presentación, NO una llave. El `id` de arriba sigue
   * siendo la clave primaria y lo que referencian las demás tablas; este código
   * existe para que una persona distinga de un vistazo a la gente de un local
   * de la de otro, cosa que un identificador opaco no permite.
   *
   * Es nulo sólo durante la migración de las cuentas que ya existían; toda
   * cuenta nueva nace con el suyo.
   */
  codigo: text("codigo").unique(),

  /**
   * Fuerza el cambio de contraseña en el primer ingreso (FR-033). Arranca en
   * `true` porque toda cuenta nace con una contraseña temporal fijada por el
   * administrador general.
   */
  debeCambiarPassword: boolean("debe_cambiar_password").notNull().default(true),

  /**
   * No nulo ⇒ cuenta anonimizada (FR-044). La fila sobrevive con su `id`
   * intacto para no romper ninguna referencia histórica (Principio IV).
   */
  anonimizadaEn: timestamp("anonimizada_en", { withTimezone: true }),
});

export const sesion = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => usuario.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  impersonatedBy: text("impersonated_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cuenta = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usuario.id),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verificacion = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Los únicos campos que la anonimización toca (FR-043). */
export const CAMPOS_PERSONALES = ["name", "email", "image"] as const;

export type Usuario = typeof usuario.$inferSelect;
