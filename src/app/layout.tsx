import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { temaActual } from "@/lib/apariencia";
import "./globals.css";

/**
 * Tipografía del rediseño.
 *
 * Se cargan con `next/font`, que las descarga en el build y las sirve desde el
 * propio dominio: sin petición a un tercero en tiempo de ejecución, sin salto
 * de fuente al cargar, y funciona igual si el equipo de la taquilla no tiene
 * internet.
 *
 * **Archivo y no una grotesca neutra.** Una parqueadero se lee de pie, de
 * reojo, con luz mala y a veces con fila. Archivo viene de la señalética: las
 * mayúsculas son anchas y planas, la letra aguanta pesos altos sin cerrarse, y
 * a 900 un título manda de verdad en vez de ser el mismo texto un poco más
 * grande. Ésa era la queja: tipografía sin carácter.
 *
 * La monoespaciada no es decorativa. Placas, horas, importes y códigos se leen
 * en columna y se comparan de un vistazo; con ancho variable, "MTQ845" y
 * "GHZ109" no se alinean y el ojo pierde el renglón.
 */
const sans = Archivo({
  subsets: ["latin"],
  // Variable: el rango entero en un archivo, así que usar 900 para un título y
  // 450 para el cuerpo no cuesta una descarga más. Es lo que permite tener
  // escala de verdad en vez de dos pesos y confiar en el tamaño.
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--fuente-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Parquivo",
    template: "%s · Parquivo",
  },
  description: "Gestión inteligente para parqueaderos",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // La apariencia se resuelve en el servidor y viaja ya puesta en el HTML, así
  // no hay parpadeo al cargar.
  const tema = await temaActual();

  return (
    <html
      lang="es"
      data-tema={tema}
      className={`${sans.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
