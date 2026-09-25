import type { ReglaRedondeo } from "@/db/esquema";
import { redondear } from "@/dominio/cobro/redondeo";
import { calcularImporte } from "@/dominio/tarifas/calcular";
import type { HorarioDelCobro } from "@/dominio/tarifas/jornadas";
import type {
  BeneficioAplicado,
  CobroConConvenios,
  ConvenioAplicable,
  TarifaAplicable,
} from "@/dominio/tarifas/modelos";

/**
 * El cobro con sus convenios aplicados.
 *
 * PURO: no importa nada de `src/db` salvo tipos, no lee el reloj y no consulta
 * nada. La cuenta de aplicaciones previas VIENE COMO DATO en cada convenio; no
 * se averigua acá. Eso es lo que permite probar la regla del límite diario hoy,
 * sin que exista historial de movimientos, y lo que hará que la taquilla sólo
 * tenga que aportar un número sin que la regla cambie.
 *
 * EL ORDEN NO ES ARBITRARIO y está fijado por la especificación:
 *
 *   minutos cobrables
 *     └─ menos los minutos regalados, desde el comienzo
 *        └─ tarifa
 *           └─ menos los porcentajes, sumados y acotados al 100 %
 *              └─ tope en pesos de cada convenio
 *                 └─ redondeo del establecimiento, que nunca sube
 *                    └─ total, nunca negativo
 *
 * Los minutos van antes que la tarifa porque una hora gratis no vale lo mismo
 * según dónde caiga: puede entrar la plena o la mínima. Descontar del importe
 * daría otro número, y uno más difícil de explicar.
 */
export function aplicarConvenios(datos: {
  entrada: Date;
  salida: Date;
  tarifa: TarifaAplicable;
  horario: HorarioDelCobro;
  convenios: ConvenioAplicable[];
  redondeo: ReglaRedondeo;
}): CobroConConvenios {
  const { entrada, salida, tarifa, horario, convenios, redondeo } = datos;

  const con = (minutosGratis: number) =>
    calcularImporte({ entrada, salida, tarifa, horario, minutosGratis });

  const base = con(0);
  const beneficios: BeneficioAplicado[] = [];

  const anotar = (c: ConvenioAplicable, extra: Partial<BeneficioAplicado> = {}) =>
    beneficios.push({
      convenioId: c.id,
      nombre: c.nombre,
      activacion: c.activacion,
      beneficio: c.beneficio,
      descontado: 0,
      minutosRegalados: 0,
      recortadoPorTope: false,
      ...extra,
    });

  // ── 1. Los que ya gastaron su cupo del día ───────────────────────────
  const disponibles: ConvenioAplicable[] = [];
  for (const c of convenios) {
    if (c.limiteDiario !== null && c.aplicacionesPreviasHoy >= c.limiteDiario) {
      anotar(c, { noAplicado: "limite_diario" });
    } else {
      disponibles.push(c);
    }
  }

  // Se declara antes de `cerrar`, que la lee. Al revés funcionaba —para cuando
  // se invoca ya está inicializada— pero se lee como un descuido.
  let acotada = false;

  const cerrar = (importe: number, cobro = base, minutosRegalados = 0): CobroConConvenios => {
    const redondeado = Math.max(0, redondear(importe, redondeo));
    return {
      ...cobro,
      importe: redondeado,
      importeBase: base.importe,
      minutosBase: base.minutosTotales,
      minutosRegalados,
      beneficios,
      sumaPorcentajesAcotada: acotada,
      redondeo: { regla: redondeo, restado: importe - redondeado },
    };
  };

  // ── 2. Los que determinan el total por sí solos ──────────────────────
  //
  // "Sin cobro" y "tarifa fija" cortocircuitan: el resto de beneficios deja de
  // tener efecto. Entre varios gana el más favorable al cliente, que es el
  // mismo criterio con el que el redondeo nunca sube. El desglose deja
  // constancia de los desplazados en vez de omitirlos: un convenio que
  // desaparece sin explicación se lee como una falla del sistema.
  const determinantes = disponibles.filter(
    (c) => c.beneficio === "sin_cobro" || c.beneficio === "tarifa_fija",
  );

  if (determinantes.length > 0) {
    const importeDe = (c: ConvenioAplicable) => (c.beneficio === "sin_cobro" ? 0 : (c.valor ?? 0));
    const gana = determinantes.reduce((a, b) => (importeDe(b) < importeDe(a) ? b : a));
    const total = importeDe(gana);

    for (const c of disponibles) {
      if (c === gana) anotar(c, { descontado: base.importe - total });
      else anotar(c, { noAplicado: "desplazado" });
    }

    return cerrar(total);
  }

  // ── 3. Beneficios de tiempo, uno tras otro ───────────────────────────
  //
  // Se aplican acumulativamente y se mide la diferencia que produce cada uno.
  // Es lo que permite decir en el desglose cuánto puso cada acuerdo, que es lo
  // que hace auditable un cobro con varios convenios encima.
  const deTiempo = disponibles.filter((c) => c.beneficio === "minutos_gratis");
  let minutos = 0;
  let devuelto = 0;

  for (const c of deTiempo) {
    const antes = con(minutos).importe;
    const despues = con(minutos + (c.valor ?? 0)).importe;
    const aporte = antes - despues;

    const recorta = c.topePesos !== null && aporte > c.topePesos;
    const efectivo = recorta ? c.topePesos! : aporte;
    // El exceso vuelve al total: el tope limita lo que ESE convenio descuenta,
    // no los minutos que regala.
    devuelto += aporte - efectivo;

    minutos += c.valor ?? 0;
    anotar(c, {
      descontado: efectivo,
      minutosRegalados: c.valor ?? 0,
      recortadoPorTope: recorta,
    });
  }

  const trasTiempo = con(minutos);
  const importeTrasTiempo = trasTiempo.importe + devuelto;

  // ── 4. Porcentajes: se SUMAN, y la suma se acota al 100 % ────────────
  //
  // Se suman y no se encadenan porque es lo que un operario puede explicarle a
  // un cliente en la caja sin hacer cuentas: 50 % y 20 % son 70 %, no 60 %.
  // Sumar obliga al freno: tres convenios del 40 % descuentan el 100 %, no el
  // 120 %, que dejaría el total en negativo.
  const dePorcentaje = disponibles.filter((c) => c.beneficio === "porcentaje");
  const bruto = dePorcentaje.reduce((n, c) => n + (c.valor ?? 0), 0);
  acotada = bruto > 100;
  const factor = acotada ? 100 / bruto : 1;

  let descuento = 0;
  for (const c of dePorcentaje) {
    const suyo = Math.round((importeTrasTiempo * (c.valor ?? 0) * factor) / 100);
    const recorta = c.topePesos !== null && suyo > c.topePesos;
    const efectivo = recorta ? c.topePesos! : suyo;

    descuento += efectivo;
    anotar(c, { descontado: efectivo, recortadoPorTope: recorta });
  }

  return cerrar(
    Math.max(0, importeTrasTiempo - descuento),
    trasTiempo,
    base.minutosTotales - trasTiempo.minutosTotales,
  );
}
