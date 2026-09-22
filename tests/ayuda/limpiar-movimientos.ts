import { Client } from "pg";

/**
 * Borra movimientos y lo que cuelga de ellos, para limpiar entre pruebas.
 *
 * Va por el rol DUEÑO y no por la puerta de plataforma, y ésa es la razón de
 * que exista: el disparador de inmutabilidad ata a los dos roles que la
 * aplicación usa, incluido `app_platform`. Limpiar una base de pruebas es
 * mantenimiento, no una operación del producto, así que usa el rol que hace
 * mantenimiento.
 *
 * Que haga falta este rodeo es buena señal: significa que ninguna ruta de la
 * aplicación puede borrar un movimiento cerrado ni por descuido.
 */
export async function limpiarMovimientos(): Promise<void> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_MIGRATOR });
  await cliente.connect();
  try {
    await cliente.query("delete from correccion");
    await cliente.query("delete from movimiento");
  } finally {
    await cliente.end();
  }
}
