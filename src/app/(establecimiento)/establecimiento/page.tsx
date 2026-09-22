import { headers } from "next/headers";
import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import {
  botonMenudo,
  botonSecundario,
  cifra,
  insignia,
  rotuloSeccion,
  textoTenue,
  tituloPantalla,
} from "@/app/ui";
import { ArmazonEstablecimiento } from "../nav";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import { obtenerMiParqueadero } from "@/dominio/parqueaderos/listar";
import { estadoDeConfiguracion } from "@/dominio/parqueaderos/estado-configuracion";

export const metadata = { title: "Mi parqueadero" };

/**
 * Panel del establecimiento (maqueta 8a).
 *
 * Deliberadamente NO recibe identificador por ruta ni por parámetro: el ámbito
 * sale de la sesión (FR-009) y la política RLS deja exactamente una fila
 * visible. Un parámetro que no existe no se puede manipular.
 *
 * La pantalla responde tres preguntas y en ese orden: qué datos tiene
 * declarados el establecimiento, qué configuración ya está puesta, y qué falta
 * antes de poder operar. Lo último va aparte y en ámbar porque es lo que
 * decide si se puede abrir la taquilla hoy.
 */
export default async function MiEstablecimiento() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    // FR-033: la contraseña temporal debe cambiarse antes que nada.
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");

  // Pantalla de administración: el operario no entra.
  //
  // Va acá y no sólo escondiendo la entrada del menú, porque la constitución
  // es explícita (FR-003): esconder una opción NUNCA constituye control de
  // acceso. Escribiendo la dirección a mano se llegaba igual.
  //
  // Se redirige en vez de lanzar: no es un error, es que esta pantalla no es
  // suya, y la taquilla es donde sí tiene trabajo.
  if (!puede(contexto, "establecimiento.administrar.ver")) redirect("/taquilla");

  // Suspendido o dado de baja: la pantalla operativa no aplica.
  if (contexto.estado !== "activo" && contexto.estado !== "pendiente") {
    redirect("/restringido");
  }

  const [propio, configuracion] = await Promise.all([
    obtenerMiParqueadero(contexto),
    estadoDeConfiguracion(contexto),
  ]);

  if (!propio) {
    return (
      <ArmazonEstablecimiento>
        <h1 style={tituloPantalla}>Mi parqueadero</h1>
        <p style={textoTenue}>No se encontró su establecimiento.</p>
      </ArmazonEstablecimiento>
    );
  }

  return (
    <ArmazonEstablecimiento>
      {/* La cabecera: el nombre manda y todo lo demás lo acompaña en la misma
          línea. Debajo, un filete a sangre que cierra el bloque —lo que antes
          hacía el borde superior de la primera tarjeta—. */}
      <header style={cabecera}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ ...tituloPantalla, margin: 0 }}>{propio.nombre}</h1>
          <span
            style={{
              ...insignia,
              background: propio.estado === "activo" ? "var(--marca)" : "var(--aviso-fondo)",
              color: "var(--marca-sobre)",
            }}
          >
            {propio.estado === "activo" ? "Activo" : "Pendiente"}
          </span>
          <code style={{ ...cifra, fontSize: "13px", color: "var(--texto-tenue)" }}>
            {propio.codigo}
          </code>
          <Link href="/establecimiento/editar" style={{ ...botonSecundario, marginLeft: "auto" }}>
            Editar datos
          </Link>
        </div>

        <p style={{ ...textoTenue, fontSize: "14px", marginTop: "10px" }}>
          El código y el estado los fija la plataforma. Lo demás lo administra usted.
        </p>
      </header>

      {/* Lo que falta va PRIMERO y a lo ancho, no en una esquina.
          Es lo único de esta pantalla sobre lo que hay que hacer algo hoy, y
          antes vivía abajo a la derecha, después de todo lo que ya está bien. */}
      {configuracion.pendientes.length > 0 && (
        <section style={{ marginBottom: "44px" }}>
          <h2
            className="rotulo-filete"
            style={{ ...rotuloSeccion, color: "var(--aviso-tinta)", marginBottom: "12px" }}
          >
            Falta por declarar
          </h2>
          <div className="grupo">
            {configuracion.pendientes.map((pendiente) => (
              <p key={pendiente} style={pendienteTexto}>
                {pendiente}
              </p>
            ))}
          </div>
        </section>
      )}

      <div className="ficha-columnas">
        <section>
          <h2 className="rotulo-filete" style={rotuloSeccion}>
            Datos del establecimiento
          </h2>
          <dl className="filas" style={{ margin: 0 }}>
            <Dato termino="Nombre" valor={propio.nombre} />
            <Dato termino="Dirección" valor={propio.direccion} />
            <Dato termino="Ciudad" valor={propio.ciudad} />
            <Dato termino="Teléfono" valor={propio.telefono} />
            <Dato termino="Código interno" valor={propio.codigo} nota="No se puede modificar" mono />
            <Dato termino="Registrado el" valor={enLetras(propio.creadoEn)} />
          </dl>
        </section>

        <section>
          <h2 className="rotulo-filete" style={rotuloSeccion}>
            Configuración declarada
          </h2>

          {/* Cada línea es un enlace ENTERO, no un texto con un botón al lado.
              Se va a esa pantalla, así que el objetivo debe ser la fila: un
              botón de 40 píxeles al final de una fila de 400 obliga a apuntar. */}
          <div className="filas filas-vivas">
            {configuracion.lineas.map((linea) => (
              <Link key={linea.rotulo} href={linea.href} style={filaConfig}>
                <strong style={{ fontSize: "15px", minWidth: "104px" }}>{linea.rotulo}</strong>
                <span style={{ fontSize: "13px", color: "var(--texto-tenue)", flex: 1, minWidth: 0 }}>
                  {linea.resumen}
                </span>
                <span aria-hidden="true" style={flecha}>
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ArmazonEstablecimiento>
  );
}

const cabecera: CSSProperties = {
  paddingBottom: "22px",
  marginBottom: "44px",
  borderBottom: "1px solid var(--borde)",
};

/**
 * Un pendiente: texto y nada más.
 *
 * Llevó una regla de color en el canto y se quitó. Un mensaje no necesita que
 * lo señalen con una línea al lado: lo que dice de qué va es el rótulo de su
 * sección, que ya está en el color del aviso. La línea era una caja a medias,
 * y las cajas a medias son el mismo problema con menos lados.
 */
const pendienteTexto: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  lineHeight: 1.55,
  color: "var(--texto)",
  maxWidth: "48em",
};

const filaConfig: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  color: "var(--texto)",
  textDecoration: "none",
};

const flecha: CSSProperties = {
  color: "var(--texto-tenue)",
  fontSize: "15px",
  flex: "none",
};

function Dato({
  termino,
  valor,
  nota,
  mono = false,
}: {
  termino: string;
  valor: string | null;
  nota?: string;
  mono?: boolean;
}) {
  return (
    // Ni relleno ni filete propio: los pone la lista, que es la que sabe cuál
    // es la primera fila y cuál la última.
    <div style={{ display: "flex", gap: "16px" }}>
      <dt style={{ minWidth: "170px", fontSize: "13px", color: "var(--texto-tenue)" }}>{termino}</dt>
      <dd
        style={{
          flex: 1,
          margin: 0,
          fontSize: "14px",
          fontWeight: 500,
          ...(mono ? cifra : null),
        }}
      >
        {valor || "—"}
        {nota && (
          <span
            style={{
              display: "block",
              fontFamily: "inherit",
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--texto-tenue)",
              marginTop: "1px",
            }}
          >
            {nota}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * "03 de febrero de 2026", como pide la maqueta.
 *
 * Con zona horaria fija: el servidor puede estar en UTC y una fecha creada a
 * las 19:00 de Bogotá se mostraría como el día siguiente.
 */
function enLetras(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(fecha);
}
