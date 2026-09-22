/**
 * Genera muestras del ticket, para mirarlas sin impresora.
 *
 * Salen del MISMO código que imprime la taquilla, así que lo que se ve acá es
 * exactamente lo que sale por el papel. Escribe los archivos en
 * `scripts/spike-impresion/`.
 *
 *   npx tsx scripts/muestra-ticket.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { comprobanteHtml } from "../src/app/(establecimiento)/taquilla/comprobante-html";
import type { Comprobante } from "../src/dominio/taquilla/comprobante";

const local = {
  nombre: "Parqueadero Centro Andino",
  direccion: "Carrera 11 #82-71",
  ciudad: "Bogotá",
  telefono: "601 742 1180",
};

const entrada = new Date("2026-08-22T11:12:00-05:00");
const salida = new Date("2026-08-22T16:15:00-05:00");

const base: Comprobante = {
  tipo: "entrada",
  establecimiento: local,
  codigo: "PCA-000147",
  rotulo: "KHT482",
  placa: "KHT482",
  fichaNumero: null,
  tipoVehiculo: "Automóvil",
  entradaEn: entrada,
  salidaEn: null,
  atendio: "OP-04",
  cobro: null,
  importe: null,
  minutosDentro: null,
  cortesia: null,
  emitidoEn: entrada,
  reimpresion: false,
};

const muestras: [string, Comprobante][] = [
  ["ticket-entrada.html", base],
  [
    "ticket-salida.html",
    {
      ...base,
      tipo: "salida",
      salidaEn: salida,
      minutosDentro: 303,
      importe: 12_600,
      emitidoEn: salida,
      cobro: {
        importe: 12_600,
        importeBase: 14_000,
        minutosBase: 303,
        minutosRegalados: 0,
        beneficios: [
          {
            convenioId: "x",
            nombre: "C. C. Andino",
            activacion: "sello",
            beneficio: "porcentaje",
            descontado: 1_400,
            minutosRegalados: 0,
            recortadoPorTope: false,
          },
        ],
        sumaPorcentajesAcotada: false,
        redondeo: { regla: "peso", restado: 0 },
      } as Comprobante["cobro"],
    },
  ],
  [
    "ticket-bicicleta.html",
    {
      ...base,
      rotulo: "Ficha 7",
      placa: null,
      fichaNumero: 7,
      tipoVehiculo: "Bicicleta",
    },
  ],
];

// Los dos anchos que existen en el comercio. Conviene tener los dos a mano:
// mirar el mismo ticket en 58 y en 80 es la forma más rápida de ver cuál
// corresponde al rollo que hay puesto.
for (const ancho of [58, 80] as const) {
  for (const [archivo, c] of muestras) {
    const destino = join("scripts", "spike-impresion", `${ancho}mm-${archivo}`);
    writeFileSync(destino, comprobanteHtml(c, ancho), "utf8");
    console.log("escrito", destino);
  }
}
