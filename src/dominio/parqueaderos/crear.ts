import { like, sql } from "drizzle-orm";
import { comoPlataforma, type Tx } from "@/db/ambito";
import { parqueadero, type Parqueadero } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { siglaConDesempate, siglaDe } from "./sigla";

export type DatosNuevoParqueadero = {
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
};

export class DatosInvalidos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "DatosInvalidos";
  }
}

/**
 * Cuántas siglas alternativas se prueban antes de rendirse.
 *
 * Cada reintento alarga la sigla —PCH, PCH2, PCH3—, así que el tope también
 * acota cuánto puede crecer: más de esto y el código dejaría de ser legible,
 * que es justamente para lo que existe.
 */
const INTENTOS_CODIGO = 9;

/**
 * Da de alta un establecimiento (FR-014).
 *
 * No existe registro público: el alta es siempre manual y la ejecuta un
 * administrador general autenticado (FR-014, decidido en clarificación).
 */
export async function crearParqueadero(
  contexto: Contexto,
  datos: DatosNuevoParqueadero,
): Promise<Parqueadero> {
  exigir(contexto, "parqueadero.crear");

  const nombre = datos.nombre.trim();
  if (nombre.length === 0) {
    throw new DatosInvalidos("El nombre del establecimiento es obligatorio");
  }

  return comoPlataforma("administracion_plataforma", async (tx) => {
    const codigo = await siglaLibre(tx, nombre);

    const [creado] = await tx
      .insert(parqueadero)
      .values({
        codigo,
        nombre,
        direccion: datos.direccion?.trim() || null,
        ciudad: datos.ciudad?.trim() || null,
        telefono: datos.telefono?.trim() || null,
      })
      .returning();

    return creado!;
  });
}

/**
 * Primera variante libre de la sigla que corresponde a este nombre.
 *
 * La sigla sale del nombre, así que dos establecimientos parecidos chocan con
 * facilidad: "Centro Histórico" y "Casa Hernández" dan ambos `PCH`. El segundo
 * pasa a `PCH2`.
 *
 * La variante se ELIGE antes de insertar, en vez de insertar y reintentar ante
 * el choque. Reintentar no funciona acá: el alta ocurre dentro de una
 * transacción y una violación de unicidad la deja abortada, de modo que el
 * segundo intento fallaría por transacción abortada y no por el código. El
 * cerrojo de aviso serializa a los que compartan sigla base —y sólo a esos—
 * para que dos altas simultáneas no elijan la misma variante.
 */
async function siglaLibre(tx: Tx, nombre: string): Promise<string> {
  const base = siglaDe(nombre);

  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${base}))`);

  const parecidas = await tx
    .select({ codigo: parqueadero.codigo })
    .from(parqueadero)
    .where(like(parqueadero.codigo, `${base}%`));

  const tomadas = new Set(parecidas.map((p) => p.codigo));

  for (let intento = 1; intento <= INTENTOS_CODIGO; intento++) {
    const candidata = siglaConDesempate(base, intento);
    if (!tomadas.has(candidata)) return candidata;
  }

  throw new DatosInvalidos(
    "Ya hay demasiados establecimientos con un nombre parecido; use uno más distinto",
  );
}
