import { SeccionesNav } from "./secciones-nav";
import { MarcaCQS, Wordmark } from "./wordmark";
import { TransicionDeSeccion } from "./transicion-seccion";

/**
 * Barra lateral fija del rediseño.
 *
 * Reemplaza a las cabeceras horizontales. El handoff la fija en 212px y deja el
 * contenido elástico: no es un ancho de maqueta sino una decisión: con la
 * navegación siempre visible a la izquierda, el ancho vertical libre es lo que
 * permite que la taquilla muestre a la vez la placa y quién está adentro.
 *
 * En pantalla angosta se convierte en una fila superior desplazable en vez de
 * ocupar la mitad del espacio. No se usa una barra de pestañas inferior todavía
 * porque el handoff la define junto con las pantallas móviles, que llegan
 * después.
 */

export type Seccion = {
  href: string;
  texto: string;
  /**
   * El rótulo de la barra inferior del teléfono, cuando difiere.
   *
   * Las maquetas móviles no repiten los nombres del menú de escritorio: donde
   * el computador dice "Mi parqueadero" el teléfono dice "Inicio", y donde el
   * computador despliega tarifas, horario y turnos por separado, el teléfono
   * los agrupa bajo "Config". No es un recorte por falta de espacio: en una
   * barra de cinco columnas, un rótulo largo se parte o se corta, y un menú
   * ilegible no es un menú.
   */
  textoMovil?: string;
  ajustes?: boolean;
  /**
   * Sólo para quien administra el establecimiento.
   *
   * Es comodidad, NO control de acceso: la constitución lo dice con todas sus
   * letras (FR-003), y quien escriba la dirección a mano llega igual. Cada una
   * de estas pantallas comprueba el permiso por su cuenta antes de consultar
   * nada. Esto sólo evita ofrecerle a un operario seis puertas cerradas.
   */
  soloAdmin?: boolean;
  /**
   * Sólo en el teléfono.
   *
   * Existe para lo que en el computador YA está a la vista y en el teléfono no
   * cabe. El caso concreto es "Adentro ahora": en pantalla ancha es el panel
   * derecho de la taquilla y ponerlo además en el menú sería mandar a otra
   * pantalla a ver lo que ya se está viendo.
   *
   * Se decide con una clase y no comprobando el ancho en el navegador: así el
   * marcado sale igual del servidor y no hay un parpadeo mientras el cliente
   * averigua en qué pantalla está.
   */
  soloMovil?: boolean;
};

export function BarraLateral({
  titulo,
  secciones,
  persona,
  pie,
}: {
  /** Qué es este menú: "Terminal de taquilla", "Administración de la plataforma". */
  titulo: string;
  secciones: Seccion[];
  /** Quién está usando el sistema, al pie. */
  persona?: { nombre: string; rol: string };
  /** Bloque inferior extra: turno abierto en la taquilla. */
  pie?: React.ReactNode;
}) {
  return (
    <nav aria-label={titulo} className="barra-lateral" style={contenedor}>
      {/* En el teléfono esta cabecera pasa a ser UNA fila —marca y nombre al
          lado, no apilados—, como en las maquetas 7b y 7c. Lleva clase y no
          sólo estilo incrustado porque una consulta de medios no puede tocar un
          atributo `style`, que es la trampa que este proyecto ya pisó dos
          veces. */}
      <div className="barra-cabecera" style={cabecera}>
        <Wordmark tamano={20} />
        <p className="barra-rotulo" style={rotulo}>
          {titulo}
        </p>
      </div>

      <SeccionesNav secciones={secciones} />

      {/* El pie NO se dibuja en el teléfono: allí la barra es una fila de
          pestañas abajo y no tiene dónde ponerlo, y apilarlo entre la cabecera
          y el contenido empujaba el campo de placa fuera de la primera
          pantalla. La cuenta y su salida viven en Ajustes, que es donde el
          teléfono las busca. */}
      <div className="barra-pie" style={pieEstilo}>
        {/* Quién está adentro. En una taquilla que varias personas comparten
            durante el día, saber con qué cuenta se está trabajando evita
            registrar un turno entero a nombre de quien no era. */}
        {persona && (
          <>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>{persona.nombre}</p>
            <p style={{ margin: "2px 0 12px", fontSize: "12px", color: "var(--texto-tenue)" }}>
              {persona.rol}
            </p>
          </>
        )}
        {pie}
      </div>
    </nav>
  );
}

/** Envuelve la barra y el contenido. El contenido queda elástico. */
export function ConBarraLateral({
  barra,
  children,
  sinRelleno = false,
}: {
  barra: React.ReactNode;
  children: React.ReactNode;
  /**
   * Quita el relleno del contenido, para las pantallas que llevan su propia
   * división en columnas y necesitan llegar hasta el borde. Hoy sólo la
   * taquilla, cuyo panel de "adentro ahora" va pegado al lado derecho.
   */
  sinRelleno?: boolean;
}) {
  return (
    <div style={armazon}>
      {barra}
      {/* El lienzo va acá y no en el armazón entero: la barra lateral tiene
          su propio fondo, y una retícula corriendo por debajo del menú lo
          único que haría es competir con los rótulos. */}
      <main
        className={sinRelleno ? "lienzo contenido contenido-sangre" : "lienzo contenido"}
        style={sinRelleno ? contenidoASangre : contenidoBase}
      >
        <TransicionDeSeccion>{children}</TransicionDeSeccion>
      </main>

      {/* Quién hizo el software. Va acá, en el armazón, y no pantalla por
          pantalla: puesta una vez sale en todas, y no hay forma de que una
          nueva se olvide de llevarla. */}
      <span className="marca-agua">
        <MarcaCQS />
      </span>
    </div>
  );
}

const armazon: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
};

/**
 * Sólo lo que NO depende del ancho de la pantalla.
 *
 * El tamaño de la barra vive en `globals.css`, bajo la clase
 * `.barra-lateral`, y no acá. La razón es concreta y ya costó un error: un
 * estilo incrustado gana sobre una hoja, así que mientras `maxWidth: 212px`
 * estuvo en este objeto, la consulta de medios que la ponía al ancho completo
 * en el teléfono no hacía absolutamente nada. La regla existía, se servía, y
 * era letra muerta.
 */
const contenedor: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--superficie)",
};

/**
 * Sólo lo que NO depende del ancho. El RELLENO vive en `globals.css`.
 *
 * Y ésta es la tercera vez que el mismo error cuesta una pantalla rota: el
 * relleno inferior estaba acá incrustado, en 48px, y la regla que en el
 * teléfono lo subía a 90 para dejar sitio a la barra de pestañas no hacía
 * nada, porque un estilo incrustado gana siempre sobre una hoja. El resultado
 * era que la barra inferior tapaba el final de cada pantalla. En la taquilla,
 * que no lleva relleno, se lo comía entero.
 */
const contenidoBase: React.CSSProperties = { flex: "1 1 24rem", minWidth: 0 };

const contenidoASangre: React.CSSProperties = contenidoBase;

const cabecera: React.CSSProperties = { padding: "22px 20px 18px" };

const rotulo: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--texto-tenue)",
};

const pieEstilo: React.CSSProperties = {
  marginTop: "auto",
  padding: "18px 20px",
  borderTop: "1px solid var(--borde)",
};
