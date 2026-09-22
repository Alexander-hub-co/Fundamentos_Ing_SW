import type { RolUsuario } from "@/db/esquema";

/**
 * Nombres de los roles tal como los lee una persona.
 *
 * Están acá, y no dentro de una pantalla, porque los usan tanto el listado
 * agrupado como la ficha de cada cuenta, y dos listas separadas terminarían
 * diciendo cosas distintas del mismo rol.
 */
export const ROL_ETIQUETA: Record<RolUsuario, string> = {
  admin_general: "Administrador general",
  admin_parqueadero: "Administrador del parqueadero",
  operario: "Operario de taquilla",
};

export const ROL_DESCRIPCION: Record<RolUsuario, string> = {
  admin_general: "Gestiona la plataforma completa: todos los establecimientos y todas las cuentas.",
  admin_parqueadero: "Configura su establecimiento y consulta sus reportes.",
  operario: "Atiende la taquilla: registra entradas y salidas.",
};
