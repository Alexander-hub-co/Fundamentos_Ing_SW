"use client";

import { useActionState } from "react";
import { accionSobreConvenios, type EstadoConvenios } from "./acciones";
import { botonMenudo, deshabilitado, rotuloSeccionSuelto } from "@/app/ui";
import type { ReglaRedondeo } from "@/db/esquema";

/**
 * La regla de redondeo del establecimiento.
 *
 * Es configuración y no una constante porque el Principio II nombra las reglas
 * de redondeo entre lo que cada parqueadero decide. Vive junto a los convenios
 * porque es con los porcentajes cuando aparecen las cifras quebradas: el 50 %
 * de $13.700 son $6.850.
 */

const OPCIONES: Record<ReglaRedondeo, { etiqueta: string; ejemplo: string }> = {
  peso: { etiqueta: "Al peso", ejemplo: "$6.850 se cobra $6.850" },
  cincuentena: { etiqueta: "A los $50", ejemplo: "$6.870 se cobra $6.850" },
  centena: { etiqueta: "A los $100", ejemplo: "$6.850 se cobra $6.800" },
};

export function Redondeo({ actual }: { actual: ReglaRedondeo }) {
  const [estado, accion, enviando] = useActionState(accionSobreConvenios, {} as EstadoConvenios);

  return (
    <section style={{ marginBottom: "22px" }}>
      <h2 className="rotulo-filete" style={rotuloSeccionSuelto}>Redondeo</h2>

      <form action={accion} style={tarjeta}>
        <input type="hidden" name="accion" value="redondeo" />

        <div style={{ display: "grid", gap: "8px" }}>
          {(Object.keys(OPCIONES) as ReglaRedondeo[]).map((r) => (
            <label key={r} style={{ display: "flex", gap: "9px", alignItems: "baseline" }}>
              <input
                type="radio"
                name="regla"
                value={r}
                defaultChecked={r === actual}
                style={{ accentColor: "var(--marca)" }}
              />
              <span style={{ fontSize: "14px" }}>
                {OPCIONES[r].etiqueta}{" "}
                <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>
                  · {OPCIONES[r].ejemplo}
                </span>
              </span>
            </label>
          ))}
        </div>

        {/* La garantía que hace segura cualquiera de las tres. Se dice en la
            pantalla y no sólo en el código: es lo que le preocupa a quien
            responde por la caja. */}
        <p style={{ margin: "12px 0 0", fontSize: "12px", color: "var(--texto-tenue)", lineHeight: 1.5 }}>
          El redondeo siempre baja, nunca sube: no se le cobra al cliente un peso que el
          cálculo no haya producido. Las dos últimas opciones existen porque casi no circulan
          monedas por debajo de cincuenta pesos.
        </p>

        <button
          type="submit"
          disabled={enviando}
          style={{ ...deshabilitado(botonMenudo, enviando), marginTop: "12px" }}
        >
          {enviando ? "Guardando…" : "Guardar"}
        </button>

        {estado.error && (
          <p role="alert" style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--error-texto)" }}>
            {estado.error}
          </p>
        )}
      </form>
    </section>
  );
}

/** Sin caja: el rótulo con filete ya dice dónde empieza esto. */
const tarjeta: React.CSSProperties = {
  padding: "2px 0 0",
};
