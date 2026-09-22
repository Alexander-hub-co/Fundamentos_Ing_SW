/**
 * Aplica el esquema completo, en el único orden que funciona:
 *
 *   1. Crear los roles  — antes de poder otorgarles permisos.
 *   2. Migraciones      — crean tablas y políticas.
 *   3. Blindaje         — permisos, FORCE RLS, disparador y guardia, sobre las
 *                         tablas que el paso anterior acaba de crear.
 *
 * Las contraseñas de los roles se leen de las cadenas de conexión del entorno,
 * nunca de un archivo versionado.
 *
 * Uso: node --experimental-strip-types src/db/migrar.ts
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "pg";

const AQUI = dirname(fileURLToPath(import.meta.url));

type Credencial = { usuario: string; password: string };

function credencialDe(url: string, nombre: string): Credencial {
  const u = new URL(url);
  const usuario = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  if (!usuario || !password) {
    throw new Error(`${nombre} debe incluir usuario y contraseña.`);
  }
  return { usuario, password };
}

/** Comilla un literal SQL. Las contraseñas no pasan por interpolación cruda. */
function lit(valor: string) {
  return `'${valor.replaceAll("'", "''")}'`;
}

async function crearRoles(admin: Client) {
  const tenant = credencialDe(
    process.env.DATABASE_URL_TENANT!,
    "DATABASE_URL_TENANT",
  );
  const platform = credencialDe(
    process.env.DATABASE_URL_PLATFORM!,
    "DATABASE_URL_PLATFORM",
  );

  const roles: [Credencial, "NOBYPASSRLS" | "BYPASSRLS"][] = [
    // Sin BYPASSRLS y nunca dueño de tablas: las dos condiciones son
    // necesarias para que las políticas efectivamente lo alcancen.
    [tenant, "NOBYPASSRLS"],
    // Atraviesa RLS a propósito: autenticación y administración global.
    [platform, "BYPASSRLS"],
  ];

  for (const [cred, bypass] of roles) {
    const existe = await admin.query(
      "select 1 from pg_roles where rolname = $1",
      [cred.usuario],
    );
    if (existe.rowCount === 0) {
      await admin.query(
        `create role "${cred.usuario}" login password ${lit(cred.password)} ${bypass}`,
      );
      console.log(`  rol ${cred.usuario} creado (${bypass})`);
    } else {
      await admin.query(
        `alter role "${cred.usuario}" login password ${lit(cred.password)} ${bypass}`,
      );
      console.log(`  rol ${cred.usuario} actualizado (${bypass})`);
    }
  }
}

async function main() {
  const urlMigrator = process.env.DATABASE_URL_MIGRATOR;
  if (!urlMigrator) throw new Error("Falta DATABASE_URL_MIGRATOR");

  const admin = new Client({ connectionString: urlMigrator });
  await admin.connect();

  try {
    console.log("1. Roles");
    await crearRoles(admin);

    // Los valores de enum se agregan ANTES y fuera de la transacción de
    // Drizzle: PostgreSQL no deja usar uno en la misma transacción que lo crea,
    // y las migraciones de Drizzle corren todas juntas en una. Es idempotente,
    // así que correr el migrador dos veces no molesta.
    console.log("2. Valores de enumeración");
    await admin.query(
      `alter type modelo_cobro add value if not exists 'primera_hora_y_fraccion'`,
    );
    console.log("  al día");

    console.log("3. Migraciones de Drizzle");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(admin);
    await migrate(db, { migrationsFolder: join(AQUI, "migraciones") });
    console.log("  aplicadas");

    console.log("4. Blindaje");
    const sql = await readFile(join(AQUI, "blindaje.sql"), "utf8");
    await admin.query(sql);
    console.log("  permisos, FORCE RLS, disparador y guardia aplicados");

    console.log("5. Índices");
    const indices = await readFile(join(AQUI, "migraciones", "0002_indices.sql"), "utf8");
    await admin.query(indices);
    console.log("  aplicados");

    console.log("6. Catálogo de tipos de vehículo");
    const { sembrarCatalogoDeTipos } = await import("./semilla-catalogo");
    await sembrarCatalogoDeTipos(admin);

    console.log("7. Códigos legibles");
    const { asignarCodigosLegibles } = await import("./codigos-legibles");
    await asignarCodigosLegibles(admin);

    console.log("\nEsquema listo.");
  } finally {
    await admin.end();
  }
}

await main();
