"use client";

import { cifra } from "@/app/ui";
import {
  PantallaDeAviso,
  TarjetaDeAviso,
  accionPrincipal,
  accionSecundaria,
} from "@/app/pantalla-aviso";

/**
 * Error inesperado (maqueta 11b).
 *
 * **No muestra el mensaje del error.** Los errores del dominio son
 * deliberadamente informativos —dicen qué requisito se violó y a veces qué
 * identificador se pidió— y eso es útil en el registro del servidor, no en la
 * pantalla de quien navega. Mostrarlo convertiría cada fallo en una filtración
 * de la estructura interna.
 *
 * Sí muestra el CÓDIGO de incidente, y es lo que hace útil esta pantalla: quien
 * llama a pedir ayuda lo dicta, y con él se encuentra el detalle en el
 * registro. Sin código, el reporte es "no me funcionó" y no se puede investigar.
 *
 * Y dice una cosa que en la taquilla importa más que disculparse: **nada quedó
 * a medias**. Si estaba cobrando, el movimiento sigue abierto y el vehículo
 * puede volver a resolverse. Quien atiende necesita saber eso antes de decidir
 * si vuelve a intentar o si el cliente ya pagó.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const cuando = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date());

  return (
    <PantallaDeAviso
      ancho={560}
      acciones={
        <>
          <button type="button" onClick={reset} style={accionPrincipal}>
            Reintentar
          </button>
          <button type="button" onClick={() => history.back()} style={accionSecundaria}>
            Volver
          </button>
        </>
      }
    >
      <TarjetaDeAviso tono="error" insignia="Error inesperado" titulo="Algo falló al procesar la operación">
        La operación no se completó y nada quedó a medias: si estaba cobrando, el movimiento
        sigue abierto y puede intentarlo otra vez. Si vuelve a fallar, avísele al administrador
        con el código de abajo.
        <div
          style={{
            ...cifra,
            marginTop: "16px",
            padding: "11px 14px",
            borderRadius: "9px",
            background: "var(--fondo)",
            fontSize: "13px",
            color: "var(--texto-tenue)",
            wordBreak: "break-all",
          }}
        >
          {error.digest ?? "sin código"} · {cuando}
        </div>
      </TarjetaDeAviso>
    </PantallaDeAviso>
  );
}
