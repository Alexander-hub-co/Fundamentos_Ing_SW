import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { cerrarPools } from "@/db/pools";

/**
 * FR-006 — los convenios que ya existían siguen valiendo, sin que nadie toque
 * nada.
 *
 * CÓMO SE PRUEBA UNA MIGRACIÓN QUE YA CORRIÓ. La columna vieja `descuento_pct`
 * ya no existe: la migración la eliminó. Así que no se puede insertar una fila
 * del modelo anterior y ver qué pasa.
 *
 * Lo que sí se puede —y es lo que importa— es ejercitar la TRADUCCIÓN misma
 * contra una tabla con la forma vieja. La sentencia que se prueba acá es la
 * misma que corrió en la migración, palabra por palabra. Si alguien la cambia
 * sin pensar, esto se pone rojo.
 */

afterAll(cerrarPools);

/** La misma traducción que ejecuta 0008_convenios_vocabulario.sql. */
const TRADUCCION = sql`
  update convenio_viejo set
    activacion = 'placa',
    beneficio  = 'porcentaje',
    valor      = greatest(descuento_pct, 1)
`;

describe("la traducción de los convenios anteriores", () => {
  it("convierte un porcentaje en activación por placa con beneficio de porcentaje", async () => {
    await comoPlataforma("administracion_plataforma", async (tx) => {
      await tx.execute(sql`
        create temporary table convenio_viejo (
          nombre text,
          descuento_pct integer,
          activacion activacion_convenio,
          beneficio beneficio_convenio,
          valor integer
        ) on commit drop`);

      await tx.execute(sql`
        insert into convenio_viejo (nombre, descuento_pct) values
          ('Clínica San José', 20),
          ('Empleados', 100),
          ('Vecinos', 1)`);

      await tx.execute(TRADUCCION);

      const filas = await tx.execute(sql`
        select nombre, activacion::text, beneficio::text, valor
        from convenio_viejo order by nombre`);

      expect(filas.rows).toEqual([
        { nombre: "Clínica San José", activacion: "placa", beneficio: "porcentaje", valor: 20 },
        { nombre: "Empleados", activacion: "placa", beneficio: "porcentaje", valor: 100 },
        { nombre: "Vecinos", activacion: "placa", beneficio: "porcentaje", valor: 1 },
      ]);
    });
  });

  it("un convenio del cero por ciento no se pierde: se conserva como el mínimo expresable", async () => {
    // El porcentaje viejo admitía cero y el nuevo exige al menos uno. Un cero no
    // descontaba nada, así que traducirlo a uno no cambia lo que cobraba en la
    // práctica, y sí evita perder el acuerdo y sus placas. Son datos de
    // clientes, no un ensayo.
    await comoPlataforma("administracion_plataforma", async (tx) => {
      await tx.execute(sql`
        create temporary table convenio_viejo (
          nombre text, descuento_pct integer,
          activacion activacion_convenio, beneficio beneficio_convenio, valor integer
        ) on commit drop`);
      await tx.execute(sql`insert into convenio_viejo (nombre, descuento_pct) values ('Simbólico', 0)`);

      await tx.execute(TRADUCCION);

      const [fila] = (await tx.execute(sql`select valor from convenio_viejo`)).rows;
      expect(fila).toEqual({ valor: 1 });
    });
  });

  it("el resultado siempre satisface el CHECK que exige el vocabulario nuevo", async () => {
    // Sin esto, la traducción podría producir filas que la tabla real rechaza y
    // sólo se descubriría al migrar a un cliente con datos.
    await comoPlataforma("administracion_plataforma", async (tx) => {
      await tx.execute(sql`
        create temporary table convenio_viejo (
          nombre text, descuento_pct integer,
          activacion activacion_convenio, beneficio beneficio_convenio, valor integer,
          constraint mismo_check check ((
            beneficio = 'minutos_gratis' and valor is not null and valor > 0
          ) or (
            beneficio = 'porcentaje' and valor is not null and valor between 1 and 100
          ) or (
            beneficio = 'tarifa_fija' and valor is not null and valor >= 0
          ) or (
            beneficio = 'sin_cobro' and valor is null
          ) or beneficio is null)
        ) on commit drop`);

      await tx.execute(sql`
        insert into convenio_viejo (nombre, descuento_pct)
        select 'C' || n, n from generate_series(0, 100) as n`);

      // Si alguno de los 101 valores posibles rompiera el CHECK, esto lanzaría.
      await expect(tx.execute(TRADUCCION)).resolves.toBeDefined();
    });
  });
});

describe("las invariantes del modelo anterior siguen en pie", () => {
  it("una placa sigue perteneciendo a un solo convenio por establecimiento (FR-017)", async () => {
    // Es lo que hace determinista qué descuento le corresponde a una placa. La
    // migración tocó la tabla `convenio`, no `convenio_placa`, pero conviene
    // comprobarlo: es la clase de garantía que se pierde sin que nada avise.
    const filas = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`
        select indexdef from pg_indexes
        where tablename = 'convenio_placa'
          and indexname = 'convenio_placa_unica_por_parqueadero'`),
    );

    expect(filas.rows).toHaveLength(1);
    expect(String((filas.rows[0] as { indexdef: string }).indexdef)).toMatch(/UNIQUE/i);
  });

  it("la columna vieja ya no existe: no quedaron dos representaciones conviviendo", async () => {
    const filas = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`
        select column_name from information_schema.columns
        where table_name = 'convenio' and column_name = 'descuento_pct'`),
    );

    expect(filas.rows).toEqual([]);
  });
});
