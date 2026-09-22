import type { CSSProperties } from "react";
import { cifra } from "@/app/ui";
import type { IngresoPorHora, PorDia, PorHora, PorPersona } from "@/dominio/reportes/resumen";

/**
 * Los gráficos del reporte (maqueta 2i).
 *
 * Los tres son de MAGNITUD con un extremo destacado, no de categorías: hay una
 * sola serie y lo que cambia entre barras es cuánto, no qué. Por eso no llevan
 * leyenda —el título nombra la serie— y por eso el color no identifica nada:
 * sólo señala el máximo.
 *
 * **Desvío anotado.** La maqueta pinta ese máximo con el verde de marca,
 * #8CCF22. Ese valor está calculado para fondo oscuro; sobre la superficie
 * clara da 1,48:1 y la barra desaparece. Se usa `--acento`, que es el mismo
 * verde en oscuro y su equivalente verificado en claro, así que el gráfico se
 * lee igual en los dos temas.
 *
 * Todo va en HTML plano y sin biblioteca: son barras, y una barra es un div con
 * una altura. Traer una biblioteca de gráficos para esto costaría más de lo que
 * ahorra, y la constitución pide justificar cada añadido.
 */

const miles = (pesos: number) =>
  pesos >= 1_000_000
    ? `$${(pesos / 1_000_000).toFixed(2).replace(".", ",")}M`
    : pesos >= 1_000
      ? `$${Math.round(pesos / 1_000)}k`
      : `$${pesos}`;

const DIA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Ingresos por día.
 *
 * **Dos formas para el mismo dato, y la elige la cantidad de días.** Hasta diez
 * caben en barras, que es lo que la maqueta dibuja para la semana. Un mes son
 * más de veinte, y en barras las etiquetas se pisan hasta que no se lee
 * ninguna: pasó, y por eso existe la otra forma.
 *
 * En calendario el mes cabe entero y además se ve el patrón semanal —que los
 * viernes venden y los domingos no— que en barras había que reconstruir
 * contando columnas.
 */
export function IngresosPorDia({ datos }: { datos: PorDia[] }) {
  if (datos.length > 10) return <CalendarioDeIngresos datos={datos} />;
  return <BarrasPorDia datos={datos} />;
}

function BarrasPorDia({ datos }: { datos: PorDia[] }) {
  const maximo = Math.max(...datos.map((d) => d.ingresos), 1);

  return (
    // La altura va FIJA y no `flex: 1` con un mínimo. Una altura automática no
    // resuelve los porcentajes de los hijos, así que cada barra caía a su
    // mínimo de 6 px y las siete salían iguales: un gráfico que no decía nada.
    // El histograma de horas nunca tuvo el problema porque ya declaraba 74 px.
    <div className="gr-dias" style={{ display: "flex", alignItems: "flex-end", gap: "16px", height: "180px", marginTop: "18px", paddingBottom: "6px" }}>
      {datos.map((d) => {
        const esMaximo = d.ingresos === maximo && d.ingresos > 0;
        // Mínimo visible para el día en cero: una barra de altura cero no se
        // distingue de un día que falta.
        const alto = d.ingresos === 0 ? 6 : Math.max(6, (d.ingresos / maximo) * 100);

        return (
          <div key={d.dia.toISOString()} style={columnaDia}>
            <span
              style={{
                ...cifra,
                fontSize: "11px",
                color: esMaximo ? "var(--acento)" : "var(--texto-tenue)",
              }}
            >
              {/* Una raya y no la palabra "cerrado": en un teléfono la columna
                  mide unos 46 px y la palabra no cabe, así que se montaba sobre
                  la de al lado. Es además lo que ya usa el calendario. */}
              {d.cerrado ? "—" : miles(d.ingresos)}
            </span>
            <span
              // El valor va también en el título: quien no distingue el color
              // puede leerlo, y quien usa lector de pantalla lo oye.
              title={`${fechaLarga(d.dia)}: ${d.cerrado ? "sin cobros" : miles(d.ingresos)}`}
              style={{
                width: "100%",
                height: `${alto}%`,
                minHeight: "6px",
                background: d.cerrado
                  ? "var(--borde)"
                  : esMaximo
                    ? "var(--acento)"
                    : "var(--borde-control)",
                borderRadius: "5px 5px 0 0",
              }}
            />
            <span style={{ fontSize: "12px", color: esMaximo ? "var(--texto)" : "var(--texto-tenue)" }}>
              {DIA_CORTO[diaSemanaEnBogota(d.dia)]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * El mes en calendario.
 *
 * La intensidad codifica MAGNITUD, así que la escala es secuencial: un solo
 * tono, de claro a oscuro. Seis pasos y no un degradado continuo porque el ojo
 * no distingue diferencias finas de tono, y porque cada paso lleva un color de
 * texto verificado contra su propio fondo.
 *
 * El importe va escrito en cada celda además del color: quien no distingue
 * tonos —o mira una impresión en blanco y negro— lee el número igual. El color
 * está para ver el patrón de un vistazo, no para transportar el dato.
 */
function CalendarioDeIngresos({ datos }: { datos: PorDia[] }) {
  const maximo = Math.max(...datos.map((d) => d.ingresos), 1);

  // Cuántos huecos van antes del primer día, para que caiga en su columna. La
  // semana arranca en lunes, que es como se cuenta acá.
  const primero = datos[0]!;
  const huecos = (diaSemanaEnBogota(primero.dia) + 6) % 7;

  return (
    <div style={{ marginTop: "16px" }}>
      <div className="calendario" style={{ marginBottom: "5px" }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <span key={d} style={{ fontSize: "11px", color: "var(--texto-tenue)", textAlign: "center" }}>
            {d}
          </span>
        ))}
      </div>

      <div className="calendario">
        {Array.from({ length: huecos }, (_, i) => (
          <span key={`hueco-${i}`} className="calendario-hueco" />
        ))}

        {datos.map((d) => (
          <div
            key={d.dia.toISOString()}
            className={`calendario-celda dia-${escalon(d.ingresos, maximo)}`}
            title={`${fechaLarga(d.dia)}: ${d.cerrado ? "sin cobros" : `$${d.ingresos.toLocaleString("es-CO")}`}`}
          >
            <span style={{ ...cifra, fontSize: "11px", opacity: 0.75 }}>{numeroDeDia(d.dia)}</span>
            <span style={{ ...cifra, fontSize: "12px", fontWeight: 700, overflowWrap: "anywhere" }}>
              {d.cerrado ? "—" : miles(d.ingresos)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px", fontSize: "11px", color: "var(--texto-tenue)" }}>
        <span>menos</span>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`dia-${n}`}
            aria-hidden="true"
            style={{ width: "18px", height: "12px", borderRadius: "3px" }}
          />
        ))}
        <span>más</span>
      </div>
    </div>
  );
}

/**
 * En qué escalón cae un importe.
 *
 * Cero tiene escalón propio —el 0— y no comparte con los días flojos: un día
 * cerrado y un día de mala venta son cosas distintas, y confundirlos haría
 * parecer que el parqueadero abrió cuando no abrió.
 */
function escalon(ingresos: number, maximo: number): number {
  if (ingresos <= 0) return 0;
  const proporcion = ingresos / maximo;
  if (proporcion <= 0.2) return 1;
  if (proporcion <= 0.4) return 2;
  if (proporcion <= 0.6) return 3;
  if (proporcion <= 0.85) return 4;
  return 5;
}

const numeroDeDia = (fecha: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric" }).format(fecha);

/**
 * Lo cobrado hora a hora, para el día y el turno.
 *
 * Reemplaza al gráfico por día cuando el período es uno solo: ahí aquél tenía
 * una barra única, que no compara con nada y ocupaba media pantalla.
 */
export function IngresosPorHora({ datos }: { datos: IngresoPorHora[] }) {
  const visibles = ventanaDeHoras(datos, (d) => d.ingresos > 0);

  if (visibles.length === 0) {
    return <p style={vacio}>Todavía no se ha cobrado nada en este período.</p>;
  }

  const maximo = Math.max(...visibles.map((d) => d.ingresos), 1);

  return (
    <div style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "180px" }}>
        {visibles.map((d) => {
          const esMaximo = d.ingresos === maximo;
          return (
            <div key={d.hora} style={columnaDia}>
              <span
                style={{
                  ...cifra,
                  fontSize: "10px",
                  color: esMaximo ? "var(--acento)" : "var(--texto-tenue)",
                }}
              >
                {d.ingresos > 0 ? miles(d.ingresos) : ""}
              </span>
              <span
                title={`${String(d.hora).padStart(2, "0")}:00 — ${d.ingresos > 0 ? miles(d.ingresos) : "sin cobros"}`}
                style={{
                  width: "100%",
                  maxWidth: "44px",
                  height: `${Math.max(3, (d.ingresos / maximo) * 100)}%`,
                  minHeight: "3px",
                  background:
                    d.ingresos === 0
                      ? "var(--borde)"
                      : esMaximo
                        ? "var(--acento)"
                        : "var(--borde-control)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
              <span style={{ ...cifra, fontSize: "11px", color: "var(--texto-tenue)" }}>
                {String(d.hora).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IngresosPorPersona({ datos }: { datos: PorPersona[] }) {
  if (datos.length === 0) {
    return <p style={vacio}>Todavía no hay cobros en este período.</p>;
  }

  const maximo = Math.max(...datos.map((d) => d.ingresos), 1);

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {datos.map((d, i) => (
        <div key={d.nombre} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ minWidth: "96px", fontSize: "13px" }}>{d.nombre}</span>
          <span style={carril}>
            <span
              style={{
                display: "block",
                width: `${Math.max(2, (d.ingresos / maximo) * 100)}%`,
                height: "100%",
                background: i === 0 ? "var(--acento)" : "var(--borde-control)",
              }}
            />
          </span>
          <span style={{ ...cifra, fontSize: "12px" }}>{miles(d.ingresos)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A qué horas entra la gente.
 *
 * Se recortan las horas de los extremos en las que nunca entró nadie: un
 * parqueadero que abre a las siete no necesita seis columnas vacías delante.
 * Pero los huecos DEL MEDIO se conservan, porque "a esta hora no entra nadie"
 * es justamente lo que se viene a mirar.
 */
/**
 * Cuántas horas dibuja como mínimo un gráfico por hora.
 *
 * Sin este piso, un período con movimiento en una sola hora producía UNA barra
 * estirada a todo el ancho —una franja de color, no un gráfico— y los dos
 * rótulos de los extremos mostraban la misma hora. Es lo que se veía en "hoy"
 * y en la semana recién empezada.
 */
const HORAS_MINIMAS = 10;

/**
 * El tramo del día que se dibuja: desde la primera hora con movimiento hasta
 * la última, ensanchado a los lados hasta llegar al mínimo.
 *
 * Se recortan las horas de los extremos sin nada, porque un parqueadero que
 * abre a las siete no necesita siete columnas vacías delante; los huecos de en
 * medio se conservan, que ésos sí dicen algo.
 */
function ventanaDeHoras<T extends { hora: number }>(datos: T[], hayAlgo: (d: T) => boolean): T[] {
  const activas = datos.filter(hayAlgo);
  if (activas.length === 0) return [];

  let primera = activas[0]!.hora;
  let ultima = activas[activas.length - 1]!.hora;

  while (ultima - primera + 1 < HORAS_MINIMAS && (primera > 0 || ultima < 23)) {
    if (primera > 0) primera--;
    if (ultima - primera + 1 >= HORAS_MINIMAS) break;
    if (ultima < 23) ultima++;
  }

  return datos.filter((d) => d.hora >= primera && d.hora <= ultima);
}

/** Se rotula una hora de cada tres, y siempre los dos extremos. */
function seRotula(hora: number, primera: number, ultima: number): boolean {
  return hora === primera || hora === ultima || hora % 3 === 0;
}

export function EntradasPorHora({ datos }: { datos: PorHora[] }) {
  const visibles = ventanaDeHoras(datos, (d) => d.entradas > 0);

  if (visibles.length === 0) {
    return <p style={vacio}>Todavía no hay entradas en este período.</p>;
  }

  const primera = visibles[0]!.hora;
  const ultima = visibles[visibles.length - 1]!.hora;
  const maximo = Math.max(...visibles.map((d) => d.entradas), 1);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "84px" }}>
        {visibles.map((d) => {
          const proporcion = d.entradas / maximo;
          return (
            <span
              key={d.hora}
              title={`${String(d.hora).padStart(2, "0")}:00 — ${d.entradas} ${d.entradas === 1 ? "entrada" : "entradas"}`}
              style={{
                flex: 1,
                maxWidth: "40px",
                height: `${Math.max(3, proporcion * 100)}%`,
                background:
                  d.entradas === 0
                    ? "var(--borde)"
                    : proporcion === 1
                      ? "var(--acento)"
                      : "var(--borde-control)",
                borderRadius: "3px 3px 0 0",
              }}
            />
          );
        })}
      </div>
      <div style={{ ...cifra, display: "flex", gap: "5px", marginTop: "8px", fontSize: "11px", color: "var(--texto-tenue)" }}>
        {visibles.map((d) => (
          <span key={d.hora} style={{ flex: 1, maxWidth: "40px", textAlign: "center" }}>
            {seRotula(d.hora, primera, ultima) ? String(d.hora).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </>
  );
}

/** El día de la semana en la zona del establecimiento, no en la del servidor. */
function diaSemanaEnBogota(fecha: Date): number {
  const corto = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
  }).format(fecha);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(corto);
}

const fechaLarga = (fecha: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);

const columnaDia: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  height: "100%",
  minWidth: 0,
};

const carril: CSSProperties = {
  flex: 1,
  height: "7px",
  borderRadius: "999px",
  background: "var(--fondo)",
  overflow: "hidden",
};

const vacio: CSSProperties = { margin: 0, fontSize: "13px", color: "var(--texto-tenue)" };
