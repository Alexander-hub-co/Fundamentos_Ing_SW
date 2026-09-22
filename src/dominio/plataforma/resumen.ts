import { count, isNotNull, isNull } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, usuario } from "@/db/esquema";
import type { EstadoParqueadero } from "@/db/esquema";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { registrarUsoPrivilegio } from "@/dominio/auditoria/acceso-denegado";

export type ResumenPlataforma = {
  establecimientos: Record<EstadoParqueadero, number>;
  totalEstablecimientos: number;
  cuentas: number;
  cuentasAnonimizadas: number;
};

const ESTADOS: EstadoParqueadero[] = [
  "activo",
  "pendiente",
  "suspendido",
  "dado_de_baja",
];

/**
 * Resumen global de la plataforma (FR-049, FR-050).
 *
 * Los cuatro estados se cuentan, no sólo los dos que interesaban al principio:
 * un establecimiento suma siempre a exactamente un contador, de modo que la
 * suma de los cuatro iguala el total registrado. Si no fuera así, el panel
 * mentiría por omisión —habría establecimientos que no aparecen en ningún
 * lado— y nadie lo notaría.
 *
 * Las cuentas anonimizadas se informan aparte y no suman al total: ya no
 * representan a ninguna persona, así que contarlas como usuarios daría una
 * cifra que no corresponde a nadie.
 */
export async function obtenerResumenPlataforma(
  contexto: Contexto,
): Promise<ResumenPlataforma> {
  exigir(contexto, "plataforma.resumen");
  await registrarUsoPrivilegio(contexto, "plataforma.resumen");

  return comoPlataforma("administracion_plataforma", async (tx) => {
    // Una sola consulta agrupada en vez de cuatro: el panel debe responder en
    // menos de 2 segundos con 1.000 establecimientos (SC-007).
    const porEstado = await tx
      .select({ estado: parqueadero.estado, cantidad: count() })
      .from(parqueadero)
      .groupBy(parqueadero.estado);

    const [activas] = await tx
      .select({ cantidad: count() })
      .from(usuario)
      .where(isNull(usuario.anonimizadaEn));

    const [anonimizadas] = await tx
      .select({ cantidad: count() })
      .from(usuario)
      .where(isNotNull(usuario.anonimizadaEn));

    // Se parte de cero en los cuatro: un estado sin filas debe mostrar 0, no
    // desaparecer del panel.
    const establecimientos = Object.fromEntries(
      ESTADOS.map((e) => [e, 0]),
    ) as Record<EstadoParqueadero, number>;

    for (const fila of porEstado) {
      establecimientos[fila.estado] = fila.cantidad;
    }

    return {
      establecimientos,
      totalEstablecimientos: Object.values(establecimientos).reduce(
        (a, b) => a + b,
        0,
      ),
      cuentas: activas?.cantidad ?? 0,
      cuentasAnonimizadas: anonimizadas?.cantidad ?? 0,
    };
  });
}
