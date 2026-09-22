import type { Comprobante } from "@/dominio/taquilla/comprobante";

/**
 * El comprobante convertido en documento para el rollo.
 *
 * Se arma en el SERVIDOR y viaja como texto. Así el diseño del papel vive en un
 * solo sitio, se puede probar sin impresora, y el navegador de la taquilla no
 * tiene que saber nada más que "esto se imprime".
 *
 * Es HTML a mano y no un componente de React a propósito: lo que se manda a
 * imprimir es un documento independiente, con sus propias reglas de página, no
 * un pedazo de la aplicación. Mezclarlos haría que un cambio de estilo de la
 * pantalla saliera impreso sin que nadie lo pidiera.
 *
 * **Impresión térmica**: no hay grises fiables ni color. Todo negro sobre
 * blanco, con cuerpo suficiente para leerse en papel barato, y la altura libre
 * porque el papel es continuo y se corta donde termine.
 */
export type AnchoRollo = 58 | 80;

export function comprobanteHtml(c: Comprobante, ancho: AnchoRollo = 58): string {
  const cuerpo = c.tipo === "entrada" ? bloqueEntrada(c) : bloqueSalida(c);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapar(c.codigo)}</title>
<style>
  @page { size: ${ancho}mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: ${ancho}mm;
    box-sizing: border-box;
    padding: 4mm 3mm 6mm;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #000;
    font-size: ${ancho === 58 ? "11pt" : "12pt"};
    line-height: 1.35;
  }
  .centro { text-align: center; }
  .local { font-size: ${ancho === 58 ? "12pt" : "13pt"}; font-weight: 700; }
  .menudo { font-size: 8pt; }
  .codigo {
    font-size: ${ancho === 58 ? "15pt" : "17pt"};
    font-weight: 700; letter-spacing: .05em; margin: 2mm 0;
  }
  .placa {
    font-size: ${ancho === 58 ? "22pt" : "26pt"};
    font-weight: 700; letter-spacing: .12em; margin: 2mm 0 3mm;
    border: 2px solid #000; padding: 1.5mm 0; text-align: center;
  }
  .fila { display: flex; justify-content: space-between; gap: 2mm; }
  .fila span:last-child { font-weight: 700; text-align: right; }
  .total { font-size: ${ancho === 58 ? "16pt" : "18pt"}; font-weight: 700; margin: 1mm 0; }
  .descuento { font-size: 9pt; }
  hr { border: none; border-top: 1px dashed #000; margin: 2.5mm 0; }
  .pie { font-size: 8pt; text-align: center; margin-top: 3mm; }
  .aviso {
    margin-top: 2mm; padding: 1.5mm; border: 1px solid #000;
    font-size: 9pt; font-weight: 700; text-align: center;
  }

  /* --- Marca de quien hizo el software ---
     Tipográfica y no un mapa de bits: una térmica imprime imágenes con tramado
     y salen sucias y lentas, mientras que el texto sale nítido. Se reproduce la
     jerarquía del logo —sigla grande, LABS espaciado debajo— con la tipografía
     que la impresora ya tiene. */
  .marca { margin-top: 4mm; padding-top: 2.5mm; border-top: 1px dashed #000; text-align: center; }
  .marca-sigla {
    font-size: ${ancho === 58 ? "15pt" : "17pt"};
    font-weight: 800; letter-spacing: .18em; line-height: 1;
  }
  .marca-labs {
    font-size: 7pt; letter-spacing: .42em; margin-top: .8mm;
  }
  .marca-quien { font-size: 9pt; font-weight: 700; margin-top: 1.8mm; }
  /* El corte de línea va escrito y no se deja al azar: a 58 mm este renglón
     cae justo en el límite y el navegador lo partiría por donde le tocara. */
  .marca-que { font-size: 6.5pt; letter-spacing: .1em; margin-top: .4mm; line-height: 1.5; }
  .marca-gancho {
    font-size: 8pt; font-weight: 700; margin-top: 2mm; line-height: 1.35;
  }
  .marca-contacto { font-size: 8pt; margin-top: 1.2mm; line-height: 1.4; }
</style></head><body data-parquivo-ticket="1">
  <div class="centro local">${escapar(c.establecimiento.nombre.toUpperCase())}</div>
  ${linea(c)}
  <div class="centro codigo">${escapar(c.codigo)}</div>
  <div class="placa">${escapar(c.rotulo)}</div>
  ${cuerpo}
  <div class="pie">${escapar(fechaHora(c.emitidoEn))}${c.atendio ? ` · ${escapar(c.atendio)}` : ""}</div>
  ${c.reimpresion ? '<div class="aviso">REIMPRESIÓN</div>' : ""}
  ${marca()}
</body></html>`;
}

/**
 * La marca de quien hizo el software, al pie de todo ticket.
 *
 * Va en los dos —entrada y salida— porque el papel de entrada es el que el
 * cliente guarda en el bolsillo durante horas, y ése es justamente el que más
 * se mira.
 *
 * **Es publicidad y conviene saber dónde acaba**: sale en los tickets de los
 * clientes de los parqueaderos, no en los de Parquivo. Si algún establecimiento
 * pide quitarla, hoy hay que cambiar este archivo; el día que eso pase, se
 * convierte en un campo de la configuración del local.
 */
function marca(): string {
  return `
  <div class="marca">
    <div class="marca-sigla">CQS</div>
    <div class="marca-labs">LABS</div>
    <div class="marca-quien">Cristian Quevedo</div>
    <div class="marca-que">DESARROLLO DE SOFTWARE<br>A LA MEDIDA</div>
    <div class="marca-gancho">¿Tiene una idea de software<br>en mente? Yo se la construyo.</div>
    <div class="marca-contacto">+57 320 902 1312<br>cqs.labs@gmail.com</div>
  </div>`;
}

function linea(c: Comprobante): string {
  const partes = [c.establecimiento.direccion, c.establecimiento.ciudad].filter(Boolean);
  const contacto = c.establecimiento.telefono;

  return [
    partes.length > 0 ? `<div class="centro menudo">${escapar(partes.join(" · "))}</div>` : "",
    contacto ? `<div class="centro menudo">${escapar(contacto)}</div>` : "",
  ].join("");
}

function bloqueEntrada(c: Comprobante): string {
  return `
  <div class="fila"><span>Tipo</span><span>${escapar(c.tipoVehiculo)}</span></div>
  <div class="fila"><span>Entrada</span><span>${escapar(fechaHora(c.entradaEn))}</span></div>
  <hr>
  <div class="pie">
    Conserve este comprobante.<br>
    Sin él, la salida se verifica por la placa.
  </div>`;
}

function bloqueSalida(c: Comprobante): string {
  const filas: string[] = [
    `<div class="fila"><span>Tipo</span><span>${escapar(c.tipoVehiculo)}</span></div>`,
    `<div class="fila"><span>Entrada</span><span>${escapar(fechaHora(c.entradaEn))}</span></div>`,
    `<div class="fila"><span>Salida</span><span>${escapar(fechaHora(c.salidaEn ?? c.emitidoEn))}</span></div>`,
    `<div class="fila"><span>Permanencia</span><span>${escapar(duracion(c.minutosDentro ?? 0))}</span></div>`,
    "<hr>",
  ];

  if (c.cortesia) {
    // Una salida sin cobro tiene que decir POR QUÉ en el papel. Es lo que
    // permite que el dueño entienda después qué pasó, sin abrir el sistema.
    filas.push(
      `<div class="centro total">SIN COBRO</div>`,
      `<div class="fila descuento"><span>Motivo</span><span>${escapar(c.cortesia.motivo)}</span></div>`,
    );
    if (c.cortesia.omitido > 0) {
      filas.push(
        `<div class="fila descuento"><span>Se omitieron</span><span>${pesos(c.cortesia.omitido)}</span></div>`,
      );
    }
  } else {
    // El desglose va impreso, no sólo en pantalla: el cliente se lleva el papel
    // y con él la explicación de por qué pagó lo que pagó. Un total sin
    // desglose es lo que produce el reclamo de la semana siguiente.
    const cobro = c.cobro;
    if (cobro && cobro.importeBase !== c.importe) {
      filas.push(
        `<div class="fila descuento"><span>Tarifa sola</span><span>${pesos(cobro.importeBase)}</span></div>`,
      );
      for (const b of cobro.beneficios) {
        if (b.noAplicado) continue;
        filas.push(
          `<div class="fila descuento"><span>${escapar(b.nombre)}</span><span>−${pesos(b.descontado)}</span></div>`,
        );
      }
      if (cobro.redondeo.restado > 0) {
        filas.push(
          `<div class="fila descuento"><span>Redondeo</span><span>−${pesos(cobro.redondeo.restado)}</span></div>`,
        );
      }
      filas.push("<hr>");
    }

    filas.push(
      `<div class="centro" style="font-size:8pt;letter-spacing:.08em">TOTAL PAGADO</div>`,
      `<div class="centro total">${pesos(c.importe ?? 0)}</div>`,
    );
  }

  // El recibo lo lee el CLIENTE, no quien atiende: se le dice cuánto estuvo y
  // cuánto pagó en palabras suyas, no con la jerga de la pantalla.
  filas.push(
    "<hr>",
    `<div class="pie">Estuvo ${escapar(duracion(c.minutosDentro ?? 0))} en el parqueadero.<br>Gracias por su visita.</div>`,
  );

  return filas.join("\n  ");
}

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * "5h03", como en pantalla.
 *
 * El mismo formato en los dos sitios no es cosmético: quien atiende lee el
 * número en la pantalla y el cliente lo lee en el papel, y tienen que poder
 * comprobar que dicen lo mismo.
 */
function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

/**
 * Con la zona horaria fija.
 *
 * El servidor puede estar en UTC, y un ticket de las 19:00 de Bogotá impreso
 * como el día siguiente es un problema real cuando alguien reclama.
 */
function fechaHora(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(d);
}

/**
 * El nombre del establecimiento y el motivo de una cortesía los escribe una
 * persona, así que van escapados. Sin esto, un nombre con `<` rompe el
 * documento que se manda a la impresora.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
