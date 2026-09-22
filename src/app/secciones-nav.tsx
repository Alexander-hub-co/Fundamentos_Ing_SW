"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Seccion } from "./barra-lateral";

/**
 * La lista de secciones, con la activa resaltada.
 *
 * Es lo único de la barra que necesita ejecutarse en el navegador: la ruta
 * actual no la conoce un layout de servidor, que se renderiza una vez y sirve a
 * todas sus páginas. La alternativa —que cada página le pase cuál es la suya—
 * funciona pero se olvida al agregar la siguiente, y el menú queda sin marcar
 * sin que nada falle.
 *
 * Se compara por prefijo para que una subpágina siga marcando su sección: en
 * `/parqueaderos/<id>/editar` lo que corresponde resaltar es Parqueaderos.
 */
export function SeccionesNav({ secciones }: { secciones: Seccion[] }) {
  const ruta = usePathname();

  const activa = secciones
    .filter((s) => ruta === s.href || ruta.startsWith(`${s.href}/`))
    // La más específica gana: con /configuracion y /configuracion/tarifas
    // presentes, en la segunda no debe marcarse la primera.
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <ul className="barra-lateral-secciones" style={lista}>
      {secciones.map((s) => {
        const esActiva = activa === s.href;
        return (
          // La marca va en el elemento de lista y no en el enlace: ocultando
          // sólo el enlace, el `li` seguía ocupando su hueco en la fila de
          // pestañas.
          <li key={s.href} className={s.soloMovil ? "seccion-solo-movil" : undefined}>
            <Link
              href={s.href}
              aria-current={esActiva ? "page" : undefined}
              className={esActiva ? "seccion seccion-activa" : "seccion"}
              style={{
                ...enlace,
                fontWeight: esActiva ? 700 : 500,
              }}
            >
              {/* La barrita de arriba marca la sección activa en el teléfono.
                  Va siempre, transparente cuando no toca, para que los rótulos
                  queden alineados entre sí en lugar de saltar. */}
              <span aria-hidden="true" className="seccion-marca" />
              {s.ajustes && <Tuerca />}
              {/* Dos rótulos y no uno: la hoja muestra el que corresponde a
                  cada ancho. Escribirlo así deja los dos textos en el marcado,
                  que es lo que permite que el cambio sea sólo de estilo. */}
              <span className="seccion-texto-ancho">{s.texto}</span>
              <span className="seccion-texto-angosto">{s.textoMovil ?? s.texto}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Única iconografía del rediseño. Hereda el color del ítem con `currentColor`. */
function Tuerca() {
  const radios = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="7.2" />
      {radios.map((grados) => {
        const rad = (grados * Math.PI) / 180;
        return (
          <line
            key={grados}
            x1={12 + Math.cos(rad) * 7.2}
            y1={12 + Math.sin(rad) * 7.2}
            x2={12 + Math.cos(rad) * 10}
            y2={12 + Math.sin(rad) * 10}
          />
        );
      })}
    </svg>
  );
}

const lista: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: "0 0 18px",
  flex: 1,
};

/**
 * Sólo lo que no cambia con el ancho.
 *
 * El relleno, el color y el fondo del elemento activo viven en `globals.css`:
 * en el computador el activo es una banda que va de lado a lado del menú, y en
 * el teléfono tiene que ser una pastilla que no se pegue al borde de la
 * pantalla. Dos formas distintas del mismo estado, y una consulta de medios no
 * cabe en un atributo `style`.
 */
const enlace: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  textDecoration: "none",
};
