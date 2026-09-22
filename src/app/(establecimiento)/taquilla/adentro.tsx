import { cifra } from "@/app/ui";
import type { Ocupacion, VehiculoAdentro } from "@/dominio/taquilla/ocupacion";
import { rotuloDe } from "@/dominio/taquilla/rotulo";

/**
 * Quién está adentro ahora.
 *
 * Panel fijo a la derecha de la taquilla, como en la maqueta. No es adorno: es
 * lo que permite responder "¿está el carro de placa tal?" sin escribir nada, y
 * lo que hace que la capacidad declarada por fin sirva para algo.
 *
 * Se renderiza en el servidor: son datos y no interacción.
 */
export function Adentro({
  ocupacion,
  vehiculos,
  ahora,
}: {
  ocupacion: Ocupacion;
  vehiculos: VehiculoAdentro[];
  ahora: Date;
}) {
  const lleno = ocupacion.cupos !== null && ocupacion.total >= ocupacion.cupos;

  return (
    <aside style={panel}>
      <div style={{ padding: "20px 22px 12px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={rotulo}>Adentro ahora</span>
        <span style={{ ...cifra, fontSize: "18px", fontWeight: 800, color: lleno ? "var(--aviso-fondo)" : "var(--texto)" }}>
          {ocupacion.total}
          {ocupacion.cupos !== null && (
            <span style={{ color: "var(--texto-tenue)", fontSize: "12px" }}>/{ocupacion.cupos}</span>
          )}
        </span>
      </div>

      <div style={{ display: "flex", gap: "6px", padding: "0 22px 12px", flexWrap: "wrap" }}>
        {ocupacion.porTipo.map((t) => (
          <span key={t.nombre} style={ficha}>
            {t.nombre} {t.adentro}
            {t.cupos !== null && (
              <span style={{ color: "var(--texto-tenue)" }}>/{t.cupos}</span>
            )}
          </span>
        ))}
      </div>

      {/* Avisa sin impedir: quien está en la taquilla ve el vehículo y sabe si
          cabe mejor que el sistema. */}
      {lleno && (
        <p style={avisoLleno}>
          Al tope de la capacidad declarada. Puede seguir recibiendo si de verdad cabe.
        </p>
      )}

      <div style={encabezadoTabla}>
        <span style={{ flex: 1.2 }}>Placa</span>
        <span style={{ flex: 0.8 }}>Entrada</span>
        <span style={{ flex: 0.8 }}>Tiempo</span>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {vehiculos.length === 0 ? (
          <p style={{ padding: "18px 22px", fontSize: "13px", color: "var(--texto-tenue)", margin: 0 }}>
            No hay ningún vehículo adentro.
          </p>
        ) : (
          vehiculos.map((v) => (
            <div key={v.id} style={renglon}>
              {/* La placa, o "Ficha 7" si es una bicicleta. Sale de `rotuloDe`
                  y no de `v.placa` porque una bicicleta no tiene placa, y
                  pintarla directamente dejaba el renglón en blanco. */}
              <span style={{ ...cifra, flex: 1.2, fontWeight: 600, color: "var(--acento)" }}>
                {rotuloDe(v)}
              </span>
              <span style={{ ...cifra, flex: 0.8, color: "var(--texto-tenue)" }}>
                {hora(v.entradaEn)}
              </span>
              <span style={{ ...cifra, flex: 0.8, color: "var(--texto-tenue)" }}>
                {duracion(Math.max(0, Math.floor((ahora.getTime() - v.entradaEn.getTime()) / 60_000)))}
              </span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

const hora = (d: Date) =>
  d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--fondo)",
  overflow: "hidden",
  minWidth: 0,
};

const rotulo: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
};

const ficha: React.CSSProperties = {
  fontSize: "12px",
  padding: "4px 10px",
  borderRadius: "999px",
  background: "var(--superficie)",
  whiteSpace: "nowrap",
};

const avisoLleno: React.CSSProperties = {
  margin: "0 22px 12px",
  padding: "8px 12px",
  borderRadius: "9px",
  background: "var(--aviso-fondo)",
  color: "var(--aviso-texto)",
  fontSize: "12px",
  fontWeight: 600,
  lineHeight: 1.4,
};

const encabezadoTabla: React.CSSProperties = {
  display: "flex",
  padding: "7px 22px",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
  borderTop: "1px solid var(--borde)",
  borderBottom: "1px solid var(--borde)",
};

const renglon: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 22px",
  fontSize: "13px",
  background: "var(--superficie)",
  borderBottom: "1px solid var(--borde)",
};
