/**
 * Conjunto cerrado de campos personales de una cuenta (FR-043).
 *
 * Declararlos acá, en un solo lugar y de forma exhaustiva, es lo que hace
 * posible la anonimización: sin esta lista habría que recordar campo por campo
 * cuáles borrar, y el día que alguien agregue "teléfono" a la tabla se
 * olvidaría de anonimizarlo.
 *
 * REGLA: si mañana se añade un campo personal a `usuario`, se añade también
 * acá. La prueba de anonimización verifica que ninguno sobreviva.
 */
export const CAMPOS_PERSONALES = ["name", "email", "image"] as const;

export type CampoPersonal = (typeof CAMPOS_PERSONALES)[number];

/**
 * Genera los valores de sustitución para una cuenta anonimizada.
 *
 * El correo lleva el identificador de la cuenta porque la columna es única: dos
 * cuentas anonimizadas no pueden compartir el mismo valor. Ese identificador no
 * revela nada del titular —es el mismo que ya está en la clave primaria— y es
 * lo que permite conservar la fila sin romper ninguna referencia.
 */
export function valoresAnonimos(usuarioId: string) {
  return {
    name: "Cuenta anonimizada",
    email: `anonimizada+${usuarioId}@parquivo.invalid`,
    image: null,
  } as const;
}

/**
 * ¿Estos valores corresponden a una cuenta anonimizada?
 *
 * Se usa en las pruebas para verificar que la sustitución fue completa.
 */
export function pareceAnonimizado(valores: {
  name: string;
  email: string;
  image: string | null;
}): boolean {
  return (
    valores.name === "Cuenta anonimizada" &&
    valores.email.endsWith("@parquivo.invalid") &&
    valores.image === null
  );
}
