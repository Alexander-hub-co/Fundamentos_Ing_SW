import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { cerrarPools } from "@/db/pools";

/**
 * Guardia estructural del Principio I.
 *
 * No prueba una funcionalidad: prueba que no falte ninguna protección. Toda
 * tabla con columna de ámbito debe tener RLS habilitada, FORZADA y al menos una
 * política.
 *
 * Las tres condiciones importan por separado:
 *
 *   - Sin RLS habilitada, la tabla se lee entera.
 *   - Con RLS pero sin FORCE, el dueño de la tabla la ignora. Es la trampa que
 *     convierte un diseño correcto en una fuga silenciosa, y la que casi se
 *     cuela en F2: `blindaje.sql` enumeraba las dos tablas de F1 y las nueve
 *     nuevas se habrían quedado fuera sin que nada protestara.
 *   - Con RLS forzada pero sin política, la tabla queda inaccesible para todos;
 *     no es una fuga, pero sí un error que conviene detectar acá y no en
 *     producción.
 *
 * Esta prueba cubre también las tablas que todavía no existen: cualquiera que
 * se agregue con `parqueadero_id` y sin política hará fallar esto.
 */

afterAll(cerrarPools);

type Fila = {
  relname: string;
  habilitada: boolean;
  forzada: boolean;
  politicas: number;
};

async function tablasConAmbito(): Promise<Fila[]> {
  const r = await comoPlataforma("administracion_plataforma", (tx) =>
    tx.execute(sql`
      select c.relname,
             c.relrowsecurity        as habilitada,
             c.relforcerowsecurity   as forzada,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as politicas
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and exists (
           select 1 from pg_attribute a
            where a.attrelid = c.oid and a.attname = 'parqueadero_id' and a.attnum > 0
         )
       order by c.relname
    `),
  );
  return r.rows as unknown as Fila[];
}

describe("toda tabla con ámbito está protegida", () => {
  it("encuentra las tablas de tenencia, para descartar que la consulta esté vacía", async () => {
    const filas = await tablasConAmbito();
    expect(filas.length).toBeGreaterThanOrEqual(9);
    expect(filas.map((f) => f.relname)).toContain("tarifa");
  });

  it("todas tienen RLS habilitada", async () => {
    const sinRls = (await tablasConAmbito()).filter((f) => !f.habilitada);
    expect(sinRls.map((f) => f.relname)).toEqual([]);
  });

  it("todas la tienen FORZADA, para que el dueño tampoco la esquive", async () => {
    const sinForce = (await tablasConAmbito()).filter((f) => !f.forzada);
    expect(sinForce.map((f) => f.relname)).toEqual([]);
  });

  it("todas tienen al menos una política", async () => {
    const sinPolitica = (await tablasConAmbito()).filter((f) => f.politicas === 0);
    expect(sinPolitica.map((f) => f.relname)).toEqual([]);
  });
});
