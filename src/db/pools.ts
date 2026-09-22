import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as esquema from "./esquema";

/**
 * Dos pools, dos roles de base de datos, dos niveles de privilegio.
 *
 * Están deliberadamente encapsulados: nadie fuera de este módulo y de
 * `ambito.ts` los alcanza. Toda la aplicación pasa por `conAmbito` o
 * `comoPlataforma`, y esa es la propiedad que convierte el Principio I de
 * intención en garantía verificable.
 *
 * Ver specs/001-gestion-parqueaderos/data-model.md, sección "Los dos roles de
 * base de datos".
 */

let poolTenant: Pool | undefined;
let poolPlatform: Pool | undefined;

/** Rol `app_tenant`: sin BYPASSRLS y sin ser dueño de ninguna tabla. */
export function dbTenant() {
  poolTenant ??= new Pool({ connectionString: env().DATABASE_URL_TENANT });
  return drizzle(poolTenant, { schema: esquema });
}

/** Rol `app_platform`: con BYPASSRLS. Su uso es siempre una decisión explícita. */
export function dbPlatform() {
  poolPlatform ??= new Pool({ connectionString: env().DATABASE_URL_PLATFORM });
  return drizzle(poolPlatform, { schema: esquema });
}

/** Cierra ambos pools. Sólo para pruebas y apagado ordenado. */
export async function cerrarPools() {
  await Promise.all([poolTenant?.end(), poolPlatform?.end()]);
  poolTenant = undefined;
  poolPlatform = undefined;
}
