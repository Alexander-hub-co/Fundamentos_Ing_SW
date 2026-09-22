"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * La transición al cambiar de sección.
 *
 * El armazón con la barra lateral no se vuelve a montar al navegar: eso es lo
 * que hace que el cambio de pantalla sea instantáneo, y también lo que hace que
 * una animación de entrada escrita en CSS no se repita nunca después de la
 * primera carga. La clave por ruta la fuerza: React ve otro elemento y lo monta
 * de cero, así que la animación vuelve a correr.
 *
 * **Un solo momento y corto.** El contenido entra desde una posición ya visible
 * —14 píxeles y un desenfoque que se va—, así que si la animación no llega a
 * ejecutarse la pantalla se ve bien igual. Y corto de verdad: esto ocurre en
 * cada clic del menú, y medio segundo repetido cien veces al día deja de ser
 * elegante y pasa a ser una espera.
 */
export function TransicionDeSeccion({ children }: { children: ReactNode }) {
  const ruta = usePathname();

  return (
    <div key={ruta} className="seccion-entra">
      {children}
    </div>
  );
}
