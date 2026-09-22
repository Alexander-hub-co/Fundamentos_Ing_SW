/**
 * La marca de Parquivo. La única.
 *
 * Tipografía y no imagen: escala sin pixelarse, cambia de tema sin dos
 * archivos, y no queda una versión vieja olvidada en una pantalla.
 *
 * **El gesto es una talanquera.** La barra que va bajo el texto no es un
 * subrayado decorativo: arranca de un pivote y sube en ángulo, que es lo que
 * hace una talanquera al dejar pasar. Es el objeto que define el negocio, y da
 * un logo que no podría ser el de ningún otro producto —que era el problema de
 * la barra recta: servía para cualquier cosa—.
 *
 * El corte "PARQ" + "UIVO" se conserva del logo original, con la segunda mitad
 * en el azul de marca.
 */
export function Wordmark({
  tamano = 20,
  eslogan = false,
  animado = false,
}: {
  tamano?: number;
  /** Levanta la talanquera al entrar. Sólo en la pantalla de acceso. */
  animado?: boolean;
  /**
   * La línea de abajo, para las pantallas de entrada.
   *
   * En una barra lateral estorba —hay que leer el menú, no la promesa de la
   * marca— y por eso no viene puesta.
   */
  eslogan?: boolean;
}) {
  // La talanquera se dimensiona con el texto para que el conjunto escale de una
  // pieza en vez de tener que ajustar dos números cada vez.
  const alto = Math.max(4, tamano * 0.22);

  return (
    <span aria-label="Parquivo" style={{ display: "inline-block", lineHeight: 1 }}>
      <span
        aria-hidden="true"
        style={{
          display: "block",
          fontWeight: 800,
          fontSize: tamano,
          letterSpacing: "-0.02em",
          color: "var(--texto)",
        }}
      >
        PARQ<span style={{ color: "var(--marca-texto)" }}>UIVO</span>
      </span>

      {/* El pivote y el brazo. Va en bloque y sin ancho propio, así que mide
          exactamente lo que mide el texto de arriba. */}
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          gap: alto * 0.5,
          marginTop: alto * 0.7,
        }}
      >
        <span
          style={{
            width: alto,
            height: alto,
            borderRadius: "50%",
            background: "var(--marca-texto)",
            flex: "none",
          }}
        />
        <span
          className={animado ? "talanquera-sube" : undefined}
          style={{
            flex: 1,
            height: Math.max(2, alto * 0.5),
            borderRadius: "999px",
            background: "var(--marca-texto)",
            transformOrigin: "left center",
            transform: "rotate(-4deg)",
          }}
        />
      </span>

      {eslogan && (
        <span
          aria-hidden="true"
          style={{
            display: "block",
            marginTop: tamano * 0.55,
            fontSize: Math.max(8, tamano * 0.26),
            fontWeight: 600,
            letterSpacing: "0.19em",
            textTransform: "uppercase",
            color: "var(--texto-tenue)",
          }}
        >
          Gestión inteligente para parqueaderos
        </span>
      )}
    </span>
  );
}

/**
 * Quién hizo el software, en pequeño.
 *
 * Va dibujada y no como imagen, y eso resuelve de entrada lo del fondo: un SVG
 * no tiene fondo que quitar. Hereda el color del texto con `currentColor`, así
 * que funciona en los dos temas sin una segunda versión, y a 60 píxeles no
 * pesa nada.
 *
 * Reproduce la estructura del logo: la sigla con la Q encajada en la C, y
 * "LABS" espaciado entre dos filetes.
 */
export function MarcaCQS({ tamano = 46 }: { tamano?: number }) {
  return (
    <a
      href="mailto:cqs.labs@gmail.com"
      title="Software hecho por CQS Labs · cqs.labs@gmail.com"
      style={{
        display: "inline-block",
        lineHeight: 1,
        textDecoration: "none",
        color: "var(--texto-tenue)",
        // Discreta de partida y legible al buscarla: una marca de agua que
        // compite con el contenido deja de ser marca de agua.
        opacity: 0.4,
      }}
    >
      <svg
        width={tamano}
        height={tamano * 0.42}
        viewBox="0 0 100 42"
        fill="none"
        role="img"
        aria-label="CQS Labs"
      >
        {/* C */}
        <path
          d="M26 6.5a12.5 12.5 0 1 0 0 21"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        {/* Q, encajada en la C como en el logo */}
        <circle cx="45" cy="17" r="12.5" stroke="currentColor" strokeWidth="4.2" />
        <path d="M45 17l9.5 9.5" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
        {/* S */}
        <path
          d="M80 7.5a10 10 0 0 0-9 0 5.5 5.5 0 0 0 1 10h6a5.5 5.5 0 0 1 1 10 10 10 0 0 1-9 0"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        {/* LABS entre filetes */}
        <path d="M4 38h20M76 38h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <text
          x="50"
          y="41"
          textAnchor="middle"
          fill="currentColor"
          fontSize="10"
          fontWeight="500"
          letterSpacing="3.4"
          fontFamily="var(--fuente-sans), system-ui, sans-serif"
        >
          LABS
        </text>
      </svg>
    </a>
  );
}
