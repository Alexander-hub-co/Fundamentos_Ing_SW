/**
 * Herramienta de verificación: apunta a la base de DESARROLLO, no a la de
 * pruebas. Sólo la usa el ayudante que abre una sesión real para comprobar
 * pantallas en el navegador; nunca las suites.
 */
import { fileURLToPath } from "node:url";

process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
