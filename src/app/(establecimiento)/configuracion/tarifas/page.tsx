import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextoActual, DebeCambiarPassword } from "@/lib/sesion";
import { puede } from "@/lib/autorizacion";
import {
  catalogoDeTipos,
  historialDeTarifa,
  tarifasVigentes,
} from "@/dominio/tarifas/consultar";
import { cifra, rotuloSeccion, rotuloSeccionSuelto, tituloPantalla } from "@/app/ui";
import { ArmazonEstablecimiento } from "@/app/(establecimiento)/nav";
import { FormularioTarifa } from "./formulario";
import { Probador } from "./probador";
import type { ModeloCobro, Tarifa } from "@/db/esquema";

export const metadata = { title: "Tarifas" };

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;
/**
 * Un instante, compacto.
 *
 * Con hora y no sólo con día: dos tarifas pueden cambiarse la misma tarde, y
 * sin la hora el historial no dejaría distinguir cuál rigió antes.
 */
const momento = (d: Date) =>
  d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/**
 * Cuánto tiempo rigió una tarifa.
 *
 * Es el dato que el historial no daba y que es el que se viene a buscar: no
 * "de tal fecha a tal otra" —dos marcas de tiempo que hay que restar
 * mentalmente— sino cuánto duró. Se dice en la unidad que corresponda; "0,08
 * días" no lo entiende nadie.
 */
function rigio(desde: Date, hasta: Date): string {
  const minutos = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 60_000));
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.round(minutos / 60);
  if (horas < 48) return horas === 1 ? "1 hora" : `${horas} horas`;

  const dias = Math.round(horas / 24);
  if (dias < 60) return dias === 1 ? "1 día" : `${dias} días`;

  const meses = Math.round(dias / 30);
  return meses === 1 ? "1 mes" : `${meses} meses`;
}
const corta = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });

/** Cómo se lee una tarifa, en una línea. */
function resumen(t: Tarifa): string {
  const tope = `plena ${pesos(t.tarifaPlena)} ${t.alcancePlena === "jornada" ? "por jornada" : "por estadía"}`;

  // Un caso por modelo y sin rama por defecto: si mañana entra un cuarto, esto
  // deja de compilar en vez de describirlo mal en silencio, que es lo que
  // pasaba cuando el tercero caía en la rama de intervalos.
  switch (t.modelo) {
    case "por_minuto":
      return `Mínima ${pesos(t.tarifaMinima ?? 0)} · ${pesos(t.valorMinuto ?? 0)} por minuto · ${tope}`;
    case "por_intervalo":
      return `${pesos(t.valorIntervalo ?? 0)} cada ${t.intervaloMinutos} minutos · ${tope}`;
    case "primera_hora_y_fraccion":
      return `Primera hora ${pesos(t.valorPrimeraHora ?? 0)} · después ${pesos(t.valorIntervalo ?? 0)} cada ${t.intervaloMinutos} minutos · ${tope}`;
  }
}

export default async function PaginaTarifas() {
  const contexto = await contextoActual(await headers()).catch((e: unknown) => {
    if (e instanceof DebeCambiarPassword) redirect("/cambiar-password");
    return null;
  });

  if (!contexto) redirect("/login");
  if (contexto.tipo !== "establecimiento") redirect("/panel");
  if (contexto.estado !== "activo" && contexto.estado !== "pendiente") {
    redirect("/restringido");
  }

  const [vigentes, catalogo] = await Promise.all([tarifasVigentes(contexto), catalogoDeTipos()]);
  const administra = puede(contexto, "establecimiento.administrar.ver");

  const historiales = await Promise.all(
    vigentes.map(async (v) => ({
      tipo: v.tipo,
      versiones: await historialDeTarifa(contexto, v.tipo.id),
    })),
  );

  const vigentePorTipo = Object.fromEntries(
    vigentes.map((v) => [v.tipo.id, { modelo: v.tarifa.modelo as ModeloCobro }]),
  );

  // El catálogo completo, con o sin tarifa. Lo que falta se ve en la MISMA
  // tabla que lo declarado, no en un aviso aparte: el hueco importa justo
  // cuando se está mirando la lista, y un aviso arriba se lee una vez y se
  // ignora las siguientes.
  const filas = catalogo.map((tipo) => ({
    tipo,
    tarifa: vigentes.find((v) => v.tipo.id === tipo.id)?.tarifa ?? null,
  }));
  const faltan = filas.filter((f) => f.tarifa === null).length;

  return (
    <ArmazonEstablecimiento>
      <header style={cabecera}>
        <h1 style={{ ...tituloPantalla, margin: 0 }}>Tarifas</h1>
        <p style={introduccion}>
          Ningún importe viene precargado: el sistema no supone cuánto cobra este parqueadero.
          Al reemplazar una tarifa, la anterior queda archivada con su periodo de vigencia.
        </p>
      </header>

      {/* Las vigentes van primero. Se entra a esta pantalla a MIRAR cuánto se
          cobra mucho más a menudo que a cambiarlo, y el formulario ocupaba la
          primera columna sólo porque era la caja más grande. */}
      <div style={columnas}>
        <div style={{ display: "flex", flexDirection: "column", gap: "44px" }}>
          <section>
            <h2 className="rotulo-filete" style={{ ...rotuloSeccionSuelto, display: "flex", alignItems: "baseline", gap: "6px" }}>
              Vigentes
              {faltan > 0 && (
                <span style={{ ...cifra, fontWeight: 400, fontSize: "12px" }}>
                  ({faltan} sin declarar)
                </span>
              )}
            </h2>
            <div className="filas">
              {filas.map(({ tipo, tarifa }) => (
                // En el teléfono el renglón se reordena: nombre y fecha
                // arriba, y la descripción entera debajo. En una línea, a la
                // descripción le quedaban unos 150 px y se partía en cuatro.
                <div
                  key={tipo.id}
                  className="fila-tarifa"
                  style={renglon}
                >
                  <strong style={{ fontSize: "14px", minWidth: "88px" }}>{tipo.nombre}</strong>
                  <span style={{ fontSize: "13px", color: "var(--texto-tenue)", flex: 1 }}>
                    {tarifa ? resumen(tarifa) : "Sin tarifa declarada"}
                  </span>
                  {tarifa ? (
                    <span style={{ ...cifra, fontSize: "12px", color: "var(--texto-tenue)", whiteSpace: "nowrap" }}>
                      desde {corta(tarifa.vigenteDesde)}
                    </span>
                  ) : (
                    <span style={insigniaFalta}>Falta</span>
                  )}
                </div>
              ))}
            </div>
            {faltan > 0 && (
              <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
                Sin tarifa, la taquilla no podrá cobrar esos vehículos. Conviene resolverlo antes de
                abrir, no con un cliente esperando.
              </p>
            )}
          </section>

          {vigentes.length > 0 && (
            <section>
              <h2 className="rotulo-filete" style={rotuloSeccionSuelto}>Probador</h2>
              <Probador tipos={vigentes.map((v) => v.tipo)} />
            </section>
          )}
        </div>

        {/* El operario ve las tarifas, para poder responder "¿cuánto me
            cuesta?" sin llamar al administrador, pero no las declara. El
            formulario no se le dibuja; si lo enviara igual, la operación
            `parqueadero.editar.propio` del dominio lo rechazaría de todos
            modos, que es donde de verdad se decide. */}
        {administra && (
          <section>
            <h2 className="rotulo-filete" style={rotuloSeccionSuelto}>Declarar tarifa</h2>
            <FormularioTarifa tipos={catalogo} vigentePorTipo={vigentePorTipo} />
          </section>
        )}
      </div>

      {historiales.some((h) => h.versiones.length > 1) && (
        <section style={{ marginTop: "26px" }}>
          <h2 className="rotulo-filete" style={rotuloSeccion}>Historial de cambios</h2>
          <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--texto-tenue)" }}>
            Ninguna tarifa se borra. Un vehículo que entró bajo una tarifa anterior se cobra con
            esa, no con la de hoy.
          </p>
          {historiales
            .filter((h) => h.versiones.length > 1)
            .map((h) => (
              <div key={h.tipo.id} style={{ marginBottom: "40px" }}>
                {/* El nombre del tipo hace de rótulo de su propio grupo: sin
                    caja, es lo que dice dónde empieza una historia. */}
                <h3 style={{ ...rotuloSeccion, margin: "0 0 6px" }}>{h.tipo.nombre}</h3>
                <div className="filas filas-holgadas">
                {h.versiones.map((v) => {
                  const rige = v.vigenteHasta === null;
                  return (
                    // Dos renglones y no uno: el período arriba y la tarifa
                    // abajo. En una sola línea, dos marcas de tiempo completas
                    // y el resumen se peleaban el ancho, y ninguno de los tres
                    // se leía.
                    <div key={v.id} style={{ ...renglon, ...(rige ? enVigor : null) }}>
                      <div style={periodo}>
                        {rige ? (
                          <>
                            <span style={{ color: "var(--marca-texto)", fontWeight: 700 }}>
                              Rige ahora
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>desde {momento(v.vigenteDesde)}</span>
                          </>
                        ) : (
                          <>
                            <span>{momento(v.vigenteDesde)}</span>
                            <span aria-hidden="true">→</span>
                            <span>{momento(v.vigenteHasta!)}</span>
                            <span aria-hidden="true">·</span>
                            {/* Cuánto duró, que es lo que de verdad se viene a
                                mirar: restar dos fechas mentalmente no es
                                trabajo del lector. */}
                            <span>rigió {rigio(v.vigenteDesde, v.vigenteHasta!)}</span>
                          </>
                        )}
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: "14px" }}>{resumen(v)}</p>
                    </div>
                  );
                })}
                </div>
              </div>
            ))}
        </section>
      )}
    </ArmazonEstablecimiento>
  );
}

/** La cabecera cierra con un filete a sangre, como en Mi parqueadero. */
const cabecera: React.CSSProperties = {
  paddingBottom: "22px",
  marginBottom: "44px",
  borderBottom: "1px solid var(--borde)",
};

const introduccion: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: "14px",
  color: "var(--texto-tenue)",
  maxWidth: "52em",
};

const columnas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
  gap: "26px",
  marginTop: "26px",
  alignItems: "start",
};


/**
 * Sólo lo que NO cambia con el ancho.
 *
 * La disposición vive en `.fila-tarifa`, en la hoja. Estuvo acá incrustada con
 * `display: flex` y la regla que en el teléfono la pasaba a rejilla no hacía
 * nada, porque un estilo incrustado gana siempre.
 */
/** Sin relleno lateral: el filete de la lista va a sangre del contenido. */
const renglon: React.CSSProperties = { padding: 0 };

/** El período: menudo, monoespaciado y por encima de la tarifa. */
const periodo: React.CSSProperties = {
  ...cifra,
  display: "flex",
  gap: "7px",
  flexWrap: "wrap",
  alignItems: "baseline",
  fontSize: "12px",
  color: "var(--texto-tenue)",
};

/** La que rige hoy lleva una regla de un píxel en el canto. Nada más. */
const enVigor: React.CSSProperties = {
  paddingLeft: "13px",
  borderLeft: "1px solid var(--marca-texto)",
};

const insigniaBase: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "999px",
  whiteSpace: "nowrap",
};

const insigniaFalta: React.CSSProperties = {
  ...insigniaBase,
  background: "var(--aviso-fondo)",
  color: "var(--aviso-texto)",
};
