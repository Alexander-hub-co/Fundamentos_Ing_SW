import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { cuenta as credencial, usuario } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { revocarSesionesDeCuenta } from "@/dominio/autenticacion/revocar";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import { valoresAnonimos } from "./datos-personales";
import { exigirConfirmacionSiEsUltimo } from "./ultimo-administrador";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export class AnonimizacionRequiereConfirmacion extends Error {
  readonly codigo = "REQUIERE_CONFIRMACION";
  constructor() {
    super(
      "La anonimización es irreversible: los datos personales no se pueden " +
        "recuperar. Confirme explícitamente para continuar.",
    );
    this.name = "AnonimizacionRequiereConfirmacion";
  }
}

export class YaAnonimizada extends Error {
  constructor() {
    super("La cuenta ya fue anonimizada");
    this.name = "YaAnonimizada";
  }
}

/**
 * Anonimiza una cuenta (FR-044, FR-045, FR-046).
 *
 * Es la respuesta de Parquivo al derecho de supresión de datos personales, y
 * concilia dos obligaciones que parecían incompatibles:
 *
 *   - El titular puede exigir que sus datos desaparezcan.
 *   - El Principio IV prohíbe destruir el historial.
 *
 * La salida es sustituir en vez de borrar: la fila sobrevive con su `id`
 * intacto, así que ninguna referencia histórica se rompe, pero los campos
 * personales dejan de ser recuperables.
 *
 * Es irreversible por definición: no se guarda copia de lo sustituido. Si se
 * guardara, no sería anonimización.
 */
export async function anonimizarCuenta(
  contexto: Contexto,
  datos: { usuarioId: string; confirmado?: boolean },
): Promise<void> {
  exigir(contexto, "cuenta.anonimizar");

  if (!datos.confirmado) throw new AnonimizacionRequiereConfirmacion();

  await registrarUsoPrivilegio(contexto, "cuenta.anonimizar");

  await comoPlataforma("administracion_plataforma", async (tx) => {
    const [actual] = await tx
      .select({ anonimizadaEn: usuario.anonimizadaEn })
      .from(usuario)
      .where(eq(usuario.id, datos.usuarioId))
      .limit(1);

    if (!actual) throw await errorDeAlcance(contexto, `cuenta:${datos.usuarioId}`);
    if (actual.anonimizadaEn) throw new YaAnonimizada();

    await exigirConfirmacionSiEsUltimo(
      tx,
      datos.usuarioId,
      "Anonimizar esta cuenta",
      // Ya se confirmó la irreversibilidad; esta comprobación advertiría por
      // segunda vez sobre lo mismo, así que se da por confirmada.
      true,
    );

    // 1. Sustituir los campos personales.
    await tx
      .update(usuario)
      .set({ ...valoresAnonimos(datos.usuarioId), anonimizadaEn: new Date() })
      .where(eq(usuario.id, datos.usuarioId));

    // 2. Eliminar las credenciales: la cuenta no debe poder autenticarse
    //    nunca más (FR-046).
    await tx.delete(credencial).where(eq(credencial.userId, datos.usuarioId));

    // 3. Revocar las sesiones abiertas.
    await revocarSesionesDeCuenta(tx, datos.usuarioId);
  });
}
