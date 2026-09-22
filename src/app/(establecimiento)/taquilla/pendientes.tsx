"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  accionComprobanteEmitido,
  accionImprimirComprobante,
  type EstadoComprobante,
} from "./acciones";
import { imprimirDocumento } from "./imprimir";
import { botonMenudo, cifra, deshabilitado, rotuloSeccion } from "@/app/ui";
import type { MovimientoSinComprobante } from "@/dominio/taquilla/comprobante";

/**
 * Los tickets que nunca salieron.
 *
 * Existe porque sin ella el aviso se pierde. La impresión falla, quien atiende
 * está con un carro delante, y para cuando puede ocuparse ya llegó el vehículo
 * siguiente y el mensaje desapareció de la pantalla. Sin una lista, ese ticket
 * no se recupera nunca.
 *
 * Reimprimir NO crea nada: vuelve a leer el mismo movimiento y arma el mismo
 * papel. Es la garantía de que un ticket reimpreso no puede decir algo distinto
 * del original.
 */
export function ComprobantesPendientes({
  movimientos,
}: {
  movimientos: MovimientoSinComprobante[];
}) {
  const [estado, pedirPapel] = useActionState(accionImprimirComprobante, {} as EstadoComprobante);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const yaMandado = useRef<string | null>(null);

  // El servidor arma el papel y lo devuelve; imprimirlo es cosa de esta
  // máquina, así que ocurre acá al recibirlo.
  useEffect(() => {
    const papel = estado.comprobante;
    if (!papel) return;
    if (yaMandado.current === papel.movimientoId) return;

    yaMandado.current = papel.movimientoId;
    setOcupado(papel.movimientoId);
    setFalla(null);

    void (async () => {
      const resultado = await imprimirDocumento(papel.html);
      if (resultado.ok) {
        await accionComprobanteEmitido(papel.movimientoId);
      } else {
        setFalla(resultado.motivo);
      }
      setOcupado(null);
    })();
  }, [estado.comprobante]);

  if (movimientos.length === 0) return null;

  return (
    <section style={{ margin: "0 0 16px" }}>
      <h2 className="rotulo-filete" style={{ ...rotuloSeccion, color: "var(--aviso-tinta)" }}>
        Tickets sin imprimir · {movimientos.length}
      </h2>

      <div style={tarjeta}>
        {movimientos.map((m, i) => (
          <div
            key={m.id}
            style={{
              ...fila,
              borderBottom: i === movimientos.length - 1 ? "none" : "1px solid var(--borde)",
            }}
          >
            <span style={{ ...cifra, fontWeight: 700, fontSize: "14px" }}>{m.rotulo}</span>
            <span style={{ fontSize: "12px", color: "var(--texto-tenue)", flex: 1, minWidth: 0 }}>
              {m.codigo} · {m.salidaEn ? "cobro" : "entrada"}
            </span>
            <form action={pedirPapel}>
              <input type="hidden" name="movimientoId" value={m.id} />
              <button
                type="submit"
                disabled={ocupado === m.id}
                style={deshabilitado(botonMenudo, ocupado === m.id)}
              >
                {ocupado === m.id ? "Imprimiendo…" : "Imprimir"}
              </button>
            </form>
          </div>
        ))}
      </div>

      {(falla || estado.error) && (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--error-texto)" }}>
          {falla ?? estado.error}
        </p>
      )}

      <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
        Salen de esta lista cuando el navegador acepta el trabajo. Si el papel igual no salió,
        volver a pulsar Imprimir.
      </p>
    </section>
  );
}

const tarjeta: CSSProperties = {
  border: "1px solid var(--aviso-tinta)",
  borderRadius: "12px",
  background: "var(--superficie)",
  padding: "0 14px",
};

const fila: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "9px 0",
};
