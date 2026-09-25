/**
 * Normalización de placas.
 *
 * Sin esto, "abc 123", "ABC-123" y "abc123" serían tres clientes distintos para
 * el mismo carro, y el convenio funcionaría o no según cómo lo escribiera quien
 * atiende. Se guarda siempre normalizada, así que la comparación es exacta y no
 * depende de nadie.
 *
 * Puro y sin dependencias: lo usa el dominio y también la taquilla en F3.
 */
export function normalizarPlaca(bruta: string): string {
  return bruta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** ¿Tiene forma de placa? Deliberadamente laxo: hay formatos viejos y de otros países. */
export function esPlacaPlausible(bruta: string): boolean {
  const p = normalizarPlaca(bruta);
  return p.length >= 5 && p.length <= 8;
}
