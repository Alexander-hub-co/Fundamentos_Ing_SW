import { eq } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import { errorDeAlcance, registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";
import type { Contexto } from "@/lib/sesion";

/**
 * Soporte: el administrador general operando sobre un establecimiento ajeno.
 *
 * Existe porque la especificación lo pide (FR-029): hay que poder arreglarle
 * una tarifa por teléfono a un cliente que no se maneja bien con el sistema.
 *
 * CÓMO FUNCIONA, y por qué así. Devuelve un contexto ACOTADO al establecimiento
 * indicado, con el identificador del administrador general dentro. A partir de
 * ahí se llaman las mismas funciones de dominio que usa el propio
 * establecimiento, sin duplicar ni una línea de la mecánica.
 *
 * Es lo contrario de una escalada de privilegios: no eleva a nadie, ESTRECHA a
 * quien ya podía todo. La autorización se exige acá arriba con
 * `parqueadero.editar.cualquiera`, que sólo tiene el administrador general; el
 * contexto derivado nunca se construye sin haber pasado por esa puerta.
 *
 * La distinción que pide la especificación queda por dos vías a la vez: el
 * asiento en `uso_privilegio`, que nombra la operación y su autor, y el propio
 * dato —una tarifa declarada así queda con el administrador general en
 * `creadaPor`—. Sin esa distinción, el administrador del local vería aparecer
 * cambios que no hizo y sin forma de saber quién los hizo.
 */
export async function comoEstablecimiento(
  contexto: Contexto,
  parqueaderoId: string,
  operacion: string,
): Promise<Contexto> {
  exigir(contexto, "parqueadero.editar.cualquiera");

  const [destino] = await comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select({ id: parqueadero.id, estado: parqueadero.estado })
      .from(parqueadero)
      .where(eq(parqueadero.id, parqueaderoId))
      .limit(1),
  );

  if (!destino) throw await errorDeAlcance(contexto, `parqueadero:${parqueaderoId}`);

  // Se anota ANTES de operar. Si la operación falla después, queda igualmente
  // el rastro del intento, que es lo que interesa auditar.
  await registrarUsoPrivilegio(contexto, `soporte.${operacion}`);

  return {
    tipo: "establecimiento",
    usuarioId: contexto.usuarioId,
    // El rol del local, no el de plataforma: las funciones de dominio exigen
    // `parqueadero.editar.propio`, y este contexto ya pasó una puerta más
    // estricta.
    rol: "admin_parqueadero",
    parqueaderoId: destino.id,
    // El estado real del establecimiento, no uno inventado: si está suspendido,
    // el soporte tampoco puede cambiarle la configuración. El modo restringido
    // vale para todos.
    estado: destino.estado,
  };
}
