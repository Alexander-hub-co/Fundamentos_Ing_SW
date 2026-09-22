/**
 * Carga el entorno de pruebas antes de cualquier suite.
 *
 * Apunta a `parquivo_test`, una base distinta de la de desarrollo: las pruebas
 * de aislamiento insertan y borran establecimientos, y no deben tocar datos
 * con los que estés trabajando.
 */
import { fileURLToPath } from "node:url";

// fileURLToPath y no `.pathname`: la ruta del proyecto contiene un espacio, y
// `.pathname` lo devuelve codificado como %20.
process.loadEnvFile(fileURLToPath(new URL("../.env.test", import.meta.url)));

if (!process.env.DATABASE_URL_TENANT?.includes("_test")) {
  throw new Error(
    "Las pruebas exigen una base cuyo nombre contenga '_test'. " +
      "Abortado para no operar sobre datos de desarrollo.",
  );
}
