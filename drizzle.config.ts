import { defineConfig } from "drizzle-kit";

/**
 * Las migraciones corren con `app_migrator`, el rol dueño del esquema.
 * La aplicación en marcha NUNCA usa esta conexión.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/esquema/index.ts",
  out: "./src/db/migraciones",
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATOR ?? "",
  },
  verbose: true,
  strict: true,
});
