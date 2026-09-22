import type { Client } from "pg";

/**
 * Catálogo de tipos de vehículo.
 *
 * DATO DE INICIALIZACIÓN, no valor quemado de negocio. El Principio II prohíbe
 * literales de precio, duración o cantidad en el código; esto no es ninguno de
 * los tres: son los nombres de las cosas que un parqueadero recibe, compartidos
 * por toda la plataforma para que dos reportes sean comparables.
 *
 * `modeloSugerido` es una sugerencia para la pantalla, no una imposición: un
 * establecimiento puede cobrar sus bicicletas por minuto si así lo decide.
 *
 * Es idempotente y NO pisa lo existente: si mañana se agrega un tipo, correr el
 * migrador otra vez lo inserta sin tocar los que ya estaban.
 */
const TIPOS = [
  { codigo: "automovil", nombre: "Automóvil", modelo: "por_minuto", orden: 1 },
  { codigo: "motocicleta", nombre: "Motocicleta", modelo: "por_minuto", orden: 2 },
  { codigo: "bicicleta", nombre: "Bicicleta", modelo: "por_intervalo", orden: 3 },
] as const;

export async function sembrarCatalogoDeTipos(admin: Client): Promise<void> {
  for (const t of TIPOS) {
    await admin.query(
      `insert into tipo_vehiculo (codigo, nombre, modelo_sugerido, orden)
       values ($1, $2, $3, $4)
       on conflict (codigo) do nothing`,
      [t.codigo, t.nombre, t.modelo, t.orden],
    );
  }

  const r = await admin.query<{ n: string }>("select count(*)::text as n from tipo_vehiculo");
  console.log(`  ${r.rows[0]!.n} tipos de vehículo en el catálogo`);
}
