import Link from "next/link";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { obtenerDetalleCuenta, INGRESOS_EN_FICHA } from "@/dominio/cuentas/detalle";
import { listarParqueaderos } from "@/dominio/parqueaderos/listar";
import type { EstadoParqueadero } from "@/db/esquema";
import { botonMenudo, botonTenue, cifra, rotuloSeccion } from "@/app/ui";
import { ROL_ETIQUETA, ROL_DESCRIPCION } from "../etiquetas";
import { AccionesCuenta } from "./acciones-cuenta";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export const metadata = { title: "Ficha de la cuenta" };

/**
 * Tipado por el enum y no por `string`: si mañana aparece un estado nuevo, esto
 * deja de compilar en lugar de mostrar un hueco en blanco en la ficha.
 */
const ESTADO_ESTABLECIMIENTO: Record<EstadoParqueadero, string> = {
  activo: "Activo",
  pendiente: "Pendiente",
  suspendido: "Suspendido",
  dado_de_baja: "Dado de baja",
};

const INSIGNIA_ESTABLECIMIENTO: Record<EstadoParqueadero, { fondo: string; texto: string }> = {
  activo: { fondo: "var(--marca)", texto: "var(--marca-sobre)" },
  pendiente: { fondo: "var(--aviso-fondo)", texto: "var(--aviso-texto)" },
  suspendido: { fondo: "#b91c1c", texto: "#ffffff" },
  dado_de_baja: { fondo: "var(--texto-tenue)", texto: "#ffffff" },
};

const fechaHora = (d: Date) =>
  d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

/** Forma corta para las columnas de datos, donde se comparan de un vistazo. */
const cortaConHora = (d: Date) =>
  d.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function FichaCuenta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contexto = await contextoActual(await headers());
  const cuenta = await obtenerDetalleCuenta(contexto, id);

  if (!cuenta) throw await errorDeAlcance(contexto, `cuenta:${id}`);

  // Sólo hace falta para ofrecer la asignación; se pide únicamente si la
  // cuenta puede recibirla.
  const establecimientos =
    cuenta.rol !== "admin_general" && cuenta.establecimiento === null
      ? (await listarParqueaderos(contexto))
          .filter((p) => p.estado !== "dado_de_baja")
          .map((p) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo }))
      : [];

  return (
    <>
      <Link href="/cuentas" style={botonTenue}>
        ← Volver a cuentas
      </Link>

      <div style={encabezado}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>{cuenta.nombre}</h1>
        {cuenta.anonimizada && (
          <Marca fondo="var(--texto-tenue)" texto="var(--fondo)" rotulo="Anonimizada" />
        )}
        {cuenta.bloqueada && !cuenta.anonimizada && (
          <Marca fondo="#b91c1c" texto="#ffffff" rotulo="Bloqueada" />
        )}
        {cuenta.debeCambiarPassword && !cuenta.anonimizada && (
          <Marca fondo="var(--aviso-fondo)" texto="var(--aviso-texto)" rotulo="Contraseña temporal" />
        )}
      </div>

      {/* El nombre y el correo viven aquí arriba, así que la tabla de identidad
          no los repite: en una ficha lo que se lee dos veces se deja de leer. */}
      <p style={{ margin: 0, fontSize: "14px", color: "var(--texto-tenue)" }}>
        {cuenta.codigo && (
          <code style={{ ...cifra, fontWeight: 700, color: "var(--acento)", marginRight: "9px" }}>
            {cuenta.codigo}
          </code>
        )}
        {cuenta.email}
      </p>

      <div style={columnas}>
        <div style={pila}>
          <Seccion titulo="Identidad">
            <dl style={{ margin: 0 }}>
              <Dato
                termino="Rol"
                valor={cuenta.rol ? ROL_ETIQUETA[cuenta.rol] : null}
                nota={cuenta.rol ? ROL_DESCRIPCION[cuenta.rol] : undefined}
              />
              <Dato
                termino="Código"
                valor={cuenta.codigo}
                mono
                nota="Lleva la sigla de su establecimiento, así que dice de un vistazo a qué local pertenece."
              />
              <Dato
                termino="Correo verificado"
                valor={cuenta.emailVerificado ? "Sí" : "No"}
                nota={
                  cuenta.emailVerificado
                    ? undefined
                    : "Parquivo no envía correos todavía, así que ninguna cuenta lo está."
                }
              />
              <Dato termino="Creada el" valor={fechaHora(cuenta.creadaEn)} />
              <Dato termino="Última modificación" valor={fechaHora(cuenta.actualizadaEn)} ultimo />
            </dl>
          </Seccion>

          <Seccion titulo="Establecimiento" holgada>
            {cuenta.establecimiento ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "15px" }}>{cuenta.establecimiento.nombre}</strong>
                  <code style={{ ...cifra, fontSize: "12px", color: "var(--texto-tenue)" }}>
                    {cuenta.establecimiento.codigo}
                  </code>
                  <Marca
                    fondo={INSIGNIA_ESTABLECIMIENTO[cuenta.establecimiento.estado].fondo}
                    texto={INSIGNIA_ESTABLECIMIENTO[cuenta.establecimiento.estado].texto}
                    rotulo={ESTADO_ESTABLECIMIENTO[cuenta.establecimiento.estado]}
                  />
                  <Link
                    href={`/parqueaderos/${cuenta.establecimiento.id}`}
                    style={{ ...botonMenudo, marginLeft: "auto" }}
                  >
                    Ver la ficha
                  </Link>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--texto-tenue)" }}>
                  Vinculada desde el {fecha(cuenta.establecimiento.vinculadaDesde)}
                </p>
                {cuenta.establecimiento.estado === "suspendido" && (
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--texto-tenue)" }}>
                    Mientras esté suspendido, esta persona sólo puede cerrar lo que ya está abierto.
                  </p>
                )}
              </>
            ) : (
              <p style={vacio}>
                {cuenta.rol === "admin_general"
                  ? "Es una cuenta de administración de la plataforma: su alcance son todos los establecimientos, así que no pertenece a ninguno en particular."
                  : "Esta cuenta no está vinculada a ningún establecimiento, así que no puede trabajar en ninguno."}
              </p>
            )}
          </Seccion>

          <Seccion titulo="Acceso y contraseña">
            <dl style={{ margin: 0 }}>
              <Dato
                termino="Estado"
                valor={
                  cuenta.anonimizada
                    ? "Anonimizada: no puede entrar"
                    : cuenta.bloqueada
                      ? "Bloqueada: no puede entrar"
                      : "Activa"
                }
              />
              {cuenta.bloqueada && (
                <>
                  <Dato termino="Motivo del bloqueo" valor={cuenta.motivoBloqueo} />
                  <Dato
                    termino="El bloqueo vence"
                    valor={cuenta.bloqueoExpira ? fechaHora(cuenta.bloqueoExpira) : null}
                    nota={cuenta.bloqueoExpira ? undefined : "No vence solo; hay que desbloquear."}
                  />
                </>
              )}
              <Dato termino="Contraseña definida" valor={cuenta.credencial?.tienePassword ? "Sí" : "No"} />
              <Dato
                termino="Cambiada por última vez"
                valor={cuenta.credencial ? fechaHora(cuenta.credencial.cambiadaEn) : null}
              />
              <Dato
                termino="Debe cambiarla al entrar"
                valor={cuenta.debeCambiarPassword ? "Sí, es temporal" : "No"}
                ultimo
              />
            </dl>
          </Seccion>
        </div>

        <div style={pila}>
          <Seccion titulo="Sesiones abiertas" contador={cuenta.sesionesActivas.length} holgada>
            {cuenta.sesionesActivas.length === 0 ? (
              <p style={vacio}>No hay ninguna sesión abierta en este momento.</p>
            ) : (
              <ul style={lista}>
                {cuenta.sesionesActivas.map((s, i) => (
                  <li key={i} style={{ marginTop: i === 0 ? 0 : "13px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "14px" }}>
                        Desde {s.origen ?? "origen desconocido"}
                      </strong>
                      <span style={{ ...cifra, marginLeft: "auto", fontSize: "12px", color: "var(--texto-tenue)" }}>
                        vence {cortaConHora(s.expiraEn)}
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
                      Abierta el {fechaHora(s.creadaEn)}
                    </p>
                    {s.navegador && (
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--texto-tenue)", wordBreak: "break-word" }}>
                        {s.navegador}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          {/* Los intentos van pegados al borde de la tarjeta y separados por
              líneas: es una tabla, y darle aire a cada fila la volvería una
              lista de tarjetas donde lo que importa es la secuencia. */}
          <Seccion titulo={`Últimos ${INGRESOS_EN_FICHA} intentos de ingreso`} alRas>
            {cuenta.ingresosRecientes.length === 0 ? (
              <p style={{ ...vacio, padding: "13px 16px" }}>
                Esta cuenta todavía no registra intentos de ingreso.
              </p>
            ) : (
              <ul style={lista}>
                {cuenta.ingresosRecientes.map((r, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "9px 16px",
                      fontSize: "13px",
                      flexWrap: "wrap",
                      borderTop: i === 0 ? undefined : "1px solid var(--borde)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 9px",
                        borderRadius: "999px",
                        minWidth: "66px",
                        textAlign: "center",
                        background: r.exito ? "var(--marca)" : "#b91c1c",
                        color: r.exito ? "var(--marca-sobre)" : "#ffffff",
                      }}
                    >
                      {r.exito ? "Correcto" : "Fallido"}
                    </span>
                    <span style={cifra}>{cortaConHora(r.ocurridoEn)}</span>
                    <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--texto-tenue)" }}>
                      {r.origen ?? "origen desconocido"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </div>

      {/* Las acciones van a lo ancho y debajo, no en la barra del encabezado que
          dibuja la maqueta. Allí caben tres botones sin explicación; acá hay
          cinco, dos piden datos y una es irreversible. Un botón de anonimizar a
          un clic y sin decir qué hace es exactamente el que se pulsa por error. */}
      <section style={{ marginTop: "20px" }}>
        <h2 className="rotulo-filete" style={rotuloSeccion}>Acciones</h2>
        <div style={tarjetaHolgada}>
          {cuenta.anonimizada ? (
            <p style={vacio}>
              La cuenta fue anonimizada. Sus datos personales ya no existen y la acción no se
              puede deshacer, así que no queda nada que hacer sobre ella.
            </p>
          ) : (
            <AccionesCuenta
              id={cuenta.id}
              bloqueada={cuenta.bloqueada}
              esAdminGeneral={cuenta.rol === "admin_general"}
              tieneEstablecimiento={cuenta.establecimiento !== null}
              establecimientos={establecimientos}
            />
          )}
        </div>
      </section>
    </>
  );
}

function Marca({ fondo, texto, rotulo }: { fondo: string; texto: string; rotulo: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        background: fondo,
        color: texto,
      }}
    >
      {rotulo}
    </span>
  );
}

function Seccion({
  titulo,
  contador,
  holgada,
  alRas,
  children,
}: {
  titulo: string;
  contador?: number;
  /** Contenido libre, no una tabla: necesita el relleno completo. */
  holgada?: boolean;
  /** Filas que llegan al borde de la tarjeta, como los intentos de ingreso. */
  alRas?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="rotulo-filete" style={{ ...rotuloSeccion, display: "flex", alignItems: "baseline", gap: "6px" }}>
        {titulo}
        {contador !== undefined && (
          <span style={{ ...cifra, fontWeight: 400, fontSize: "12px" }}>({contador})</span>
        )}
      </h2>
      <div style={alRas ? tarjetaAlRas : holgada ? tarjetaHolgada : tarjeta}>{children}</div>
    </section>
  );
}

function Dato({
  termino,
  valor,
  nota,
  mono,
  ultimo,
}: {
  termino: string;
  valor: string | null;
  nota?: string;
  mono?: boolean;
  ultimo?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        padding: "8px 0",
        flexWrap: "wrap",
        borderBottom: ultimo ? undefined : "1px solid var(--borde)",
      }}
    >
      <dt style={{ minWidth: "158px", fontSize: "13px", color: "var(--texto-tenue)" }}>{termino}</dt>
      <dd style={{ margin: 0, flex: 1, minWidth: "10rem", fontSize: "14px" }}>
        <span
          style={{
            fontWeight: valor ? 500 : 400,
            wordBreak: "break-word",
            ...(mono && valor ? cifra : {}),
          }}
        >
          {valor || <span style={{ color: "var(--texto-tenue)" }}>Sin registrar</span>}
        </span>
        {nota && (
          <span
            style={{
              display: "block",
              marginTop: "1px",
              fontSize: "12px",
              fontWeight: 400,
              fontFamily: "inherit",
              color: "var(--texto-tenue)",
            }}
          >
            {nota}
          </span>
        )}
      </dd>
    </div>
  );
}

const encabezado: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  margin: "10px 0 3px",
  flexWrap: "wrap",
};

const columnas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))",
  gap: "18px",
  marginTop: "20px",
  alignItems: "start",
};

const pila: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };

const tarjeta: React.CSSProperties = {
  borderRadius: "12px",
  padding: "6px 18px",
};

const tarjetaHolgada: React.CSSProperties = { ...tarjeta, padding: "13px 18px" };

const tarjetaAlRas: React.CSSProperties = { ...tarjeta, padding: 0, overflow: "hidden" };

const lista: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0 };

const vacio: React.CSSProperties = { margin: 0, color: "var(--texto-tenue)", fontSize: "13px" };
