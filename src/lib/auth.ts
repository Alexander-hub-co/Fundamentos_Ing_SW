import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { dbPlatform } from "@/db/pools";
import * as esquema from "@/db/esquema";
import { env } from "./env";
import {
  SESION_DURACION_SEGUNDOS,
  SESION_RENOVACION_SEGUNDOS,
} from "@/dominio/autenticacion/parametros";

/**
 * Autenticación de Parquivo.
 *
 * Usa deliberadamente la conexión privilegiada (`app_platform`), y ésa es la
 * única excepción legítima al Principio I: resolver un correo a una cuenta
 * ocurre ANTES de que exista un ámbito de establecimiento, así que no puede
 * pasar por una consulta con ámbito.
 *
 * La excepción está acotada a este módulo. Una vez establecida la sesión, todo
 * el resto del sistema opera con `conAmbito`.
 *
 * Ver specs/001-gestion-parqueaderos/data-model.md, "Tablas de Better Auth".
 */
export const auth = betterAuth({
  secret: env().AUTH_SECRET,

  // Sin esto, el origen se deduce de la petición entrante y los redireccionamientos
  // pueden apuntar a donde no corresponde.
  baseURL: process.env.APP_URL ?? "http://localhost:3000",

  database: drizzleAdapter(dbPlatform(), {
    provider: "pg",
    schema: {
      user: esquema.usuario,
      session: esquema.sesion,
      account: esquema.cuenta,
      verification: esquema.verificacion,
    },
  }),

  emailAndPassword: {
    enabled: true,
    // No hay registro público: las cuentas las crea el administrador general
    // (FR-014, FR-031). Y no hay recuperación autogestionada (FR-035): el
    // restablecimiento pasa siempre por el administrador general.
    disableSignUp: true,
    requireEmailVerification: false,
  },

  user: {
    additionalFields: {
      debeCambiarPassword: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      anonimizadaEn: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  session: {
    // Persistidas en base de datos para poder revocarlas de inmediato cuando
    // se bloquea una cuenta o se suspende un establecimiento (FR-004, SC-004).
    // Sin almacenamiento en caché: una sesión revocada debe dejar de servir en
    // la petición siguiente, no cuando expire un caché.
    expiresIn: SESION_DURACION_SEGUNDOS,
    updateAge: SESION_RENOVACION_SEGUNDOS,
  },

  plugins: [
    // Se usa por sus operaciones de servidor —crear cuenta con contraseña,
    // restablecerla, bloquear y desbloquear (FR-031, FR-034, FR-036)—, ninguna
    // de las cuales envía correo.
    //
    // Su sistema de roles queda deliberadamente sin usar: la fuente de verdad
    // del rol es `asignacion.rol`, donde una restricción CHECK lo mantiene
    // coherente con el ámbito. Duplicarlo en el campo `role` de esta tabla
    // garantizaría que algún día discrepen, y la autorización de Parquivo la
    // decide `lib/autorizacion.ts`, no el plugin.
    admin(),

    // Debe ir al final: permite que las Server Actions fijen la cookie de
    // sesión. Sin esto, iniciar sesión desde una acción no deja sesión abierta.
    nextCookies(),
  ],
});

export type Sesion = typeof auth.$Infer.Session;
