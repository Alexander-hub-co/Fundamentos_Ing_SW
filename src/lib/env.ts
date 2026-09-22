/**
 * Validación de variables de entorno.
 *
 * Falla al arrancar, no en la primera consulta. Una cadena de conexión ausente
 * que se descubre a mitad de una operación es un error mucho más caro de
 * diagnosticar que uno que impide el arranque.
 *
 * Las tres conexiones son deliberadamente distintas: `app_tenant` está sujeta a
 * las políticas RLS, `app_platform` las atraviesa y `app_migrator` es dueña del
 * esquema. Ver specs/001-gestion-parqueaderos/data-model.md.
 */

type Entorno = {
  DATABASE_URL_MIGRATOR: string;
  DATABASE_URL_PLATFORM: string;
  DATABASE_URL_TENANT: string;
  AUTH_SECRET: string;
};

const REQUERIDAS = [
  "DATABASE_URL_MIGRATOR",
  "DATABASE_URL_PLATFORM",
  "DATABASE_URL_TENANT",
  "AUTH_SECRET",
] as const satisfies readonly (keyof Entorno)[];

function leerEntorno(): Entorno {
  const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${faltantes.join(", ")}.\n` +
        `Copiá .env.example a .env y completá los valores. ` +
        `Ver specs/001-gestion-parqueaderos/quickstart.md.`,
    );
  }

  return Object.fromEntries(
    REQUERIDAS.map((clave) => [clave, process.env[clave]!]),
  ) as Entorno;
}

let cache: Entorno | undefined;

/**
 * Devuelve el entorno validado. La primera llamada valida; las siguientes
 * reutilizan el resultado.
 */
export function env(): Entorno {
  cache ??= leerEntorno();
  return cache;
}
