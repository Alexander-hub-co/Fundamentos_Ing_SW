/**
 * Cómo se nombra un movimiento en pantalla y en el papel.
 *
 * Existe porque desde F4 un movimiento se identifica de DOS maneras: por placa
 * si es un vehículo, por número de ficha si es una bicicleta. Toda pantalla que
 * antes escribía la placa tiene ahora que decidir qué escribir, y esa decisión
 * se toma una vez acá en vez de repetirse —y divergir— en cada sitio.
 *
 * PURO: no importa nada de `src/db` ni consulta nada.
 */
export type Identificable = {
  placa: string | null;
  fichaNumero: number | null;
};

/**
 * El rótulo largo, para donde hay espacio: la lista de adentro, el papel.
 *
 * "Ficha 7" y no "7" a secas: un 7 suelto en una columna de placas no se
 * entiende, y quien atiende tiene las dos clases de movimiento en la misma
 * lista.
 */
export function rotuloDe(m: Identificable): string {
  if (m.placa !== null) return m.placa;
  if (m.fichaNumero !== null) return `Ficha ${m.fichaNumero}`;
  // No debería ocurrir: el CHECK de la tabla exige exactamente uno de los dos.
  // Si ocurre, se dice en vez de mostrar un hueco en blanco que nadie entiende.
  return "Sin identificador";
}

/** Si el movimiento es de una bicicleta. */
export const esBicicleta = (m: Identificable): boolean => m.fichaNumero !== null;
