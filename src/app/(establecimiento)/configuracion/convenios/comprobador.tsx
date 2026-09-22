"use client";

import { useActionState } from "react";
import { comprobarCobro, type EstadoComprobacion } from "./acciones";
import {
  botonSecundario,
  campoTexto,
  cifra,
  deshabilitado,
  importe as estiloImporte,
  rotuloSeccionSuelto,
} from "@/app/ui";
import type { TipoVehiculo } from "@/db/esquema";

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

const MOTIVO: Record<string, string> = {
  limite_diario: "alcanzó su límite del día",
  desplazado: "lo desplazó un cobro fijo",
};

/**
 * Comprobar qué cobraría una permanencia de ejemplo.
 *
 * Muestra el desglose y no sólo el total: una tarifa o un convenio mal
 * declarados no fallan, cobran mal, y eso se descubre semanas después revisando
 * ingresos. Con los tramos a la vista el error se ve el mismo día.
 */
export function Comprobador({
  tipos,
  convenios,
}: {
  tipos: TipoVehiculo[];
  convenios: { id: string; nombre: string; activacion: "sello" | "placa"; descripcion: string }[];
}) {
  const [estado, accion, enviando] = useActionState(comprobarCobro, {} as EstadoComprobacion);
  const r = estado.resultado;

  return (
    <section style={{ marginBottom: "22px" }}>
      <h2 className="rotulo-filete" style={rotuloSeccionSuelto}>Comprobar un cobro</h2>

      <form action={accion} style={tarjeta}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "14px" }}>
          <label style={etiquetado}>
            <span style={etiqueta}>Tipo de vehículo</span>
            <select name="tipoVehiculoId" required style={campoTexto}>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </label>
          <label style={etiquetado}>
            <span style={etiqueta}>Entrada</span>
            <input name="entrada" type="datetime-local" required style={{ ...campoTexto, ...cifra }} />
          </label>
          <label style={etiquetado}>
            <span style={etiqueta}>Salida</span>
            <input name="salida" type="datetime-local" required style={{ ...campoTexto, ...cifra }} />
          </label>
          <label style={etiquetado}>
            <span style={etiqueta}>Placa (opcional)</span>
            <input
              name="placa"
              placeholder="ABC123"
              style={{ ...campoTexto, ...cifra, textTransform: "uppercase" }}
            />
          </label>
        </div>

        {convenios.length > 0 && (
          <fieldset style={recuadro}>
            <legend style={{ ...etiqueta, padding: "0 6px" }}>Qué convenios aplicar</legend>
            <div style={{ display: "grid", gap: "6px" }}>
              {convenios.map((c) => (
                <label key={c.id} style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                  <input type="checkbox" name="convenio" value={c.id} style={{ accentColor: "var(--marca)" }} />
                  <span style={{ fontSize: "14px" }}>
                    {c.nombre}{" "}
                    <span style={{ fontSize: "12px", color: "var(--texto-tenue)" }}>{c.descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Simular las veces que ya se usó hoy es lo que hace comprobable el
            límite diario sin que existan movimientos. Cuando llegue la taquilla,
            ella aportará el número real y la regla no cambiará. */}
        <label style={{ ...etiquetado, marginTop: "12px" }}>
          <span style={etiqueta}>Veces que ya se aplicaron hoy</span>
          <input
            name="previas"
            type="number"
            min={0}
            defaultValue={0}
            style={{ ...campoTexto, ...cifra, width: "7rem" }}
          />
        </label>

        <button
          type="submit"
          disabled={enviando}
          style={{ ...deshabilitado(botonSecundario, enviando), marginTop: "14px" }}
        >
          {enviando ? "Calculando…" : "Comprobar"}
        </button>

        {estado.error && (
          <p role="alert" style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--error-texto)" }}>
            {estado.error}
          </p>
        )}

        {r && (
          <div role="status" style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--borde)" }}>
            <p style={{ ...estiloImporte, fontSize: "30px", lineHeight: 1.1, margin: 0, color: "var(--acento)" }}>
              {pesos(r.importe)}
            </p>
            <p style={{ margin: "2px 0 14px", fontSize: "13px", color: "var(--texto-tenue)" }}>
              Sin convenios habría cobrado {pesos(r.importeBase)} · {r.minutosBase} minutos cobrables
              {r.minutosRegalados > 0 && `, ${r.minutosRegalados} regalados`}
            </p>

            {r.beneficios.map((b, i) => (
              <div key={i} style={renglon}>
                <span style={{ opacity: b.noAplicado ? 0.6 : 1 }}>{b.nombre}</span>
                <span style={{ color: "var(--texto-tenue)", fontSize: "12px" }}>
                  {b.noAplicado
                    ? `no se aplicó: ${MOTIVO[b.noAplicado] ?? b.noAplicado}`
                    : b.recortadoPorTope
                      ? "recortado por su tope"
                      : ""}
                </span>
                <strong style={{ ...cifra, marginLeft: "auto" }}>
                  {b.noAplicado ? "—" : `−${pesos(b.descontado)}`}
                </strong>
              </div>
            ))}

            {r.sumaPorcentajesAcotada && (
              <p style={nota}>
                La suma de porcentajes pasaba del 100 % y se recortó ahí: no se genera saldo a
                favor.
              </p>
            )}
            {r.redondeoRestado > 0 && (
              <div style={renglon}>
                <span>Redondeo</span>
                <strong style={{ ...cifra, marginLeft: "auto" }}>−{pesos(r.redondeoRestado)}</strong>
              </div>
            )}

            <p style={nota}>Los límites diarios se cuentan contra el {r.dia}.</p>
          </div>
        )}
      </form>
    </section>
  );
}

/** Sin caja: el rótulo con filete ya dice dónde empieza esto. */
const tarjeta: React.CSSProperties = {
  padding: "2px 0 0",
};

const recuadro: React.CSSProperties = {
  borderRadius: "10px",
  padding: "12px 14px",
  margin: "14px 0 0",
};

const etiquetado: React.CSSProperties = { display: "grid", gap: "6px" };
const etiqueta: React.CSSProperties = { fontSize: "13px", fontWeight: 600 };

const renglon: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "baseline",
  flexWrap: "wrap",
  padding: "7px 0",
  borderBottom: "1px solid var(--borde)",
  fontSize: "13px",
};

const nota: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: "12px",
  color: "var(--texto-tenue)",
};
