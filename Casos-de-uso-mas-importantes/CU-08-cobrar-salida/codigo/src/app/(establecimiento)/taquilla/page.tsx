import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { ocupacionActual, vehiculosAdentro } from "@/dominio/taquilla/ocupacion";
import { sesionAbiertaConTurno, turnosAbribles } from "@/dominio/turnos/sesiones";
import { ArmazonEstablecimiento } from "../nav";
import { CampoPlaca } from "./campo-placa";
import { Adentro } from "./adentro";
import { PanelTurno } from "./panel-turno";
import { ComprobantesPendientes } from "./pendientes";
import { Bicicletas } from "./bicicletas";
import { fichasDisponibles } from "@/dominio/fichas/asignar";
import { movimientosSinComprobante } from "@/dominio/taquilla/comprobante";
import { cifra } from "@/app/ui";
import { preferenciasDe } from "@/dominio/preferencias/gestionar";

export const metadata = { title: "Taquilla" };

/**
 * La taquilla, según la maqueta 1b.
 *
 * Dos columnas: a la izquierda lo que se está atendiendo —la placa, el cobro y
 * su desglose—, a la derecha quién está adentro ahora. El panel derecho es de
 * ancho fijo porque es una tabla de referencia y no debe robarle espacio al
 * campo de la placa, que es lo que se mira con fila.
 *
 * Deliberadamente vacía de todo lo demás. La constitución obliga a justificar
 * cada añadido a esta pantalla, y ninguna configuración administrativa se
 * expone acá.
 *
 * Un establecimiento suspendido SÍ puede abrirla: no registrará entradas
 * nuevas, pero tiene que poder sacar los vehículos que están adentro.
 */
export default async function PaginaTaquilla() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado === "dado_de_baja") redirect("/restringido");

  const ahora = new Date();
  const [ocupacion, adentro, sesion, turnos, preferencias, sinComprobante, fichasLibres] =
    await Promise.all([
      ocupacionActual(contexto),
      vehiculosAdentro(contexto),
      sesionAbiertaConTurno(contexto, contexto.usuarioId),
      turnosAbribles(contexto, ahora),
      preferenciasDe(contexto),
      movimientosSinComprobante(contexto),
      fichasDisponibles(contexto),
    ]);

  const comoda = preferencias.densidad === "comoda";

  return (
    <ArmazonEstablecimiento sinRelleno>
      <div
        className={`taquilla-columnas toque${comoda ? " taquilla-comoda" : ""}`}
        // El tamaño elegido en Ajustes llega como variable y no como estilo del
        // campo, porque la maqueta móvil lo achica con una consulta de medios y
        // eso no cabe en un atributo `style`.
        style={{ "--placa-tamano": `${preferencias.tamanoPlaca}px` } as React.CSSProperties}
      >
        <div className="taquilla-principal" style={izquierda}>
          {contexto.estado === "suspendido" && (
            <p role="status" style={avisoSuspendido}>
              El establecimiento está suspendido: no se pueden registrar entradas nuevas, pero
              los vehículos que están adentro sí pueden salir.
            </p>
          )}
          <PanelTurno sesion={sesion} turnos={turnos} ahora={ahora} />

          {/* Va en la columna principal y no en la lateral: la lateral
              desaparece en densidad cómoda y en pantalla angosta, y un ticket
              que no salió es justamente lo que no puede quedar escondido. Se
              dibuja sola sólo cuando hay alguno. */}
          <ComprobantesPendientes movimientos={sinComprobante} />

          {/* Sólo aparece cuando el panel lateral no cabe. */}
          <Link href="/taquilla/adentro" className="taquilla-enlace-adentro" style={enlaceAdentro}>
            <span>
              <strong style={cifra}>{ocupacion.total}</strong>
              {ocupacion.cupos !== null && (
                <span style={{ color: "var(--texto-tenue)" }}> de {ocupacion.cupos}</span>
              )}{" "}
              adentro ahora
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <CampoPlaca
            confirmarCobro={preferencias.confirmarCobro}
            imprimirAuto={preferencias.imprimirAuto}
          />

          {/* Sólo si el establecimiento declaró fichas. Un parqueadero que
              únicamente recibe carros no debería ver un formulario que no va a
              usar nunca: la constitución obliga a justificar cada añadido a
              esta pantalla. */}
          {fichasLibres.total > 0 && (
            <Bicicletas disponibles={fichasLibres.disponibles} reloj={ahora.getTime()} />
          )}
        </div>

        {/* En pantalla ancha va al lado; en un celular desaparece y se llega
            por el enlace de arriba, como manda la maqueta móvil. */}
        <div className="taquilla-lateral">
          {/* Sólo quién está ADENTRO ahora. Lo que ya salió se fue a su propia
              pantalla: al lado del campo de placa competía con lo único que
              quien atiende necesita mirar con fila. */}
          <Adentro ocupacion={ocupacion} vehiculos={adentro} ahora={ahora} />
        </div>
      </div>
    </ArmazonEstablecimiento>
  );
}

const enlaceAdentro: React.CSSProperties = {
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  marginTop: "14px",
  padding: "12px 16px",
  border: "1px solid var(--borde-control)",
  borderRadius: "12px",
  background: "var(--superficie)",
  color: "var(--texto)",
  textDecoration: "none",
  fontSize: "15px",
};

/**
 * El borde derecho NO va acá.
 *
 * Separa esta columna de la lateral, así que tiene que desaparecer cuando la
 * lateral no está —en densidad cómoda, o en pantalla angosta—. Un estilo
 * incrustado le gana a cualquier regla de la hoja, de modo que si viviera acá
 * ninguna de las dos condiciones podría quitarlo. Vive en `.taquilla-principal`.
 */
const izquierda: React.CSSProperties = {
  padding: "26px 30px",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const avisoSuspendido: React.CSSProperties = {
  margin: "0 0 16px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "var(--aviso-fondo)",
  color: "var(--aviso-texto)",
  fontSize: "14px",
  fontWeight: 600,
};
