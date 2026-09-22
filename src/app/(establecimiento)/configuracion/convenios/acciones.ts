"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoActual } from "@/lib/sesion";
import {
  agregarPlaca,
  declararConvenio,
  describirConvenio,
  descuentoParaPlaca,
  quitarPlaca,
  vencerConvenio,
} from "@/dominio/convenios/gestionar";
import type {
  ActivacionConvenio,
  BeneficioConvenio,
  PeriodicidadConvenio,
  ReglaRedondeo,
} from "@/db/esquema";
import { aplicarConvenios } from "@/dominio/convenios/aplicar";
import { conveniosAplicables } from "@/dominio/convenios/consultar";
import { diaLegible } from "@/dominio/convenios/dia";
import { fijarRedondeo, politicaDeCobro } from "@/dominio/cobro/politica";
import { horarioDelCobro } from "@/dominio/horarios/consultar";
import { aTarifaAplicable, tarifaVigenteEn } from "@/dominio/tarifas/consultar";

export type EstadoConvenios = { error?: string; ok?: string };

export async function accionSobreConvenios(
  _previo: EstadoConvenios,
  datos: FormData,
): Promise<EstadoConvenios> {
  const contexto = await contextoActual(await headers());
  const accion = String(datos.get("accion") ?? "");
  const convenioId = String(datos.get("convenioId") ?? "");

  try {
    switch (accion) {
      case "registrar": {
        const hasta = String(datos.get("hasta") ?? "").trim();
        const vigencia = String(datos.get("vigencia") ?? "sin_vencimiento");
        const beneficio = String(datos.get("beneficio") ?? "") as BeneficioConvenio;

        await declararConvenio(contexto, {
          nombre: String(datos.get("nombre") ?? ""),
          activacion: String(datos.get("activacion") ?? "") as ActivacionConvenio,
          beneficio,
          // `sin_cobro` no lleva valor, y mandarlo en cero sería declarar que se
          // cobra cero, que es otra cosa.
          valor: beneficio === "sin_cobro" ? null : entero(datos.get("valor")),
          topePesos: entero(datos.get("topePesos")),
          // El límite llega como una elección explícita entre "sin límite" y un
          // número, nunca como un campo que se pudo haber dejado en blanco.
          limiteDiario:
            String(datos.get("limite") ?? "") === "sin_limite"
              ? null
              : entero(datos.get("limiteDiario")),
          // Las tres formas de vigencia son excluyentes: la elegida manda y las
          // otras no se leen, para que un campo deshabilitado que quedó con
          // texto viejo no se cuele.
          periodicidad:
            vigencia === "duracion"
              ? (String(datos.get("periodicidad") ?? "mensual") as PeriodicidadConvenio)
              : null,
          hasta:
            vigencia === "fecha" && hasta !== ""
              ? new Date(`${hasta}T23:59:59-05:00`)
              : null,
          aplicaBicicletas: datos.get("aplicaBicicletas") === "si",
        });
        break;
      }
      case "agregar_placa":
        await agregarPlaca(contexto, convenioId, String(datos.get("placa") ?? ""));
        break;
      case "quitar_placa":
        await quitarPlaca(contexto, convenioId, String(datos.get("placa") ?? ""));
        break;
      case "redondeo":
        await fijarRedondeo(contexto, String(datos.get("regla") ?? "peso") as ReglaRedondeo);
        break;
      case "vencer":
        await vencerConvenio(contexto, convenioId);
        break;
      default:
        return { error: "Acción no reconocida." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo completar" };
  }

  revalidatePath("/configuracion/convenios");
  return { ok: "Listo." };
}

export type EstadoConsulta = {
  error?: string;
  resultado?: { placa: string; nombre?: string; descripcion?: string };
};

/**
 * Consulta qué descuento tiene una placa.
 *
 * Informa, no cobra: el cobro es de la taquilla. Existe para que el
 * administrador compruebe que registró bien un convenio antes de que llegue el
 * cliente a reclamarlo.
 */
export async function consultarPlaca(
  _previo: EstadoConsulta,
  datos: FormData,
): Promise<EstadoConsulta> {
  const contexto = await contextoActual(await headers());
  const placa = String(datos.get("placa") ?? "").trim();

  if (placa === "") return { error: "Escriba una placa" };

  try {
    const c = await descuentoParaPlaca(contexto, placa, new Date());
    return {
      resultado: c
        ? { placa, nombre: c.nombre, descripcion: describirConvenio(c) }
        : { placa },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo consultar" };
  }
}

/** Un entero del formulario, o nulo si vino vacío. `""` no es cero. */
function entero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim();
  if (texto === "") return null;
  const n = Number.parseInt(texto, 10);
  return Number.isNaN(n) ? null : n;
}

export type EstadoComprobacion = {
  error?: string;
  resultado?: {
    dia: string;
    importeBase: number;
    minutosBase: number;
    minutosRegalados: number;
    importe: number;
    sumaPorcentajesAcotada: boolean;
    redondeoRestado: number;
    beneficios: {
      nombre: string;
      descontado: number;
      recortadoPorTope: boolean;
      noAplicado?: "limite_diario" | "desplazado";
    }[];
  };
};

/**
 * Comprueba qué cobraría una permanencia de ejemplo con los convenios elegidos.
 *
 * Un convenio mal declarado no falla: cobra mal, y eso se descubre semanas
 * después revisando ingresos. El desglose convierte un error silencioso en uno
 * visible.
 */
export async function comprobarCobro(
  _previo: EstadoComprobacion,
  datos: FormData,
): Promise<EstadoComprobacion> {
  const contexto = await contextoActual(await headers());

  const entrada = new Date(String(datos.get("entrada") ?? ""));
  const salida = new Date(String(datos.get("salida") ?? ""));
  if (Number.isNaN(entrada.getTime()) || Number.isNaN(salida.getTime())) {
    return { error: "Indique la entrada y la salida" };
  }
  if (salida <= entrada) return { error: "La salida tiene que ser posterior a la entrada" };

  const tipoVehiculoId = String(datos.get("tipoVehiculoId") ?? "");
  if (tipoVehiculoId === "") return { error: "Elija un tipo de vehículo" };

  try {
    const [tarifa, horario, redondeo, disponibles] = await Promise.all([
      tarifaVigenteEn(contexto, tipoVehiculoId, salida),
      horarioDelCobro(contexto),
      politicaDeCobro(contexto),
      conveniosAplicables(contexto, String(datos.get("placa") ?? "") || null, salida),
    ]);

    if (!tarifa) {
      return { error: "Ese tipo de vehículo no tiene tarifa declarada: no hay sobre qué descontar" };
    }

    const elegidos = new Set(datos.getAll("convenio").map(String));
    const previas = Number.parseInt(String(datos.get("previas") ?? "0"), 10) || 0;

    const convenios = [...disponibles.automaticos, ...disponibles.porSello]
      .filter((c) => elegidos.has(c.id))
      .map((c) => ({ ...c, aplicacionesPreviasHoy: previas }));

    const cobro = aplicarConvenios({
      entrada,
      salida,
      // La fila cruda no sirve: el calculador exige la unión discriminada, que
      // es lo que le impide leer el valor por minuto de una tarifa que no lo
      // tiene.
      tarifa: aTarifaAplicable(tarifa),
      horario,
      convenios,
      redondeo,
    });

    return {
      resultado: {
        dia: diaLegible(disponibles.dia),
        importeBase: cobro.importeBase,
        minutosBase: cobro.minutosBase,
        minutosRegalados: cobro.minutosRegalados,
        importe: cobro.importe,
        sumaPorcentajesAcotada: cobro.sumaPorcentajesAcotada,
        redondeoRestado: cobro.redondeo.restado,
        beneficios: cobro.beneficios.map((b) => ({
          nombre: b.nombre,
          descontado: b.descontado,
          recortadoPorTope: b.recortadoPorTope,
          noAplicado: b.noAplicado,
        })),
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo comprobar" };
  }
}
