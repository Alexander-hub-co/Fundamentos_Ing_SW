import Link from "next/link";
import { botonSecundario, botonTenue, cifra, rotuloSeccion } from "@/app/ui";
import { headers } from "next/headers";
import { contextoActual } from "@/lib/sesion";
import { obtenerDetalleParqueadero, type PersonaVinculada } from "@/dominio/parqueaderos/detalle";
import { resumenDeConfiguracion } from "@/dominio/parqueaderos/configuracion-resumen";
import type { EstadoParqueadero } from "@/db/esquema";
import { errorDeAlcance } from "@/dominio/auditoria/acceso-denegado";

export const metadata = { title: "Detalle del parqueadero" };

const ETIQUETA: Record<EstadoParqueadero, string> = {
  activo: "Activo",
  pendiente: "Pendiente",
  suspendido: "Suspendido",
  dado_de_baja: "Dado de baja",
};

const INSIGNIA: Record<EstadoParqueadero, { fondo: string; texto: string }> = {
  activo: { fondo: "var(--marca)", texto: "var(--marca-sobre)" },
  pendiente: { fondo: "var(--aviso-fondo)", texto: "var(--aviso-texto)" },
  suspendido: { fondo: "#b91c1c", texto: "#ffffff" },
  dado_de_baja: { fondo: "var(--texto-tenue)", texto: "#ffffff" },
};

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

export default async function DetalleParqueadero({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contexto = await contextoActual(await headers());
  const detalle = await obtenerDetalleParqueadero(contexto, id);

  if (!detalle) throw await errorDeAlcance(contexto, `parqueadero:${id}`);

  const { parqueadero: p, administradores, operarios, historial } = detalle;
  const config = await resumenDeConfiguracion(contexto, p.id);

  return (
    <>
      <Link href="/parqueaderos" style={botonTenue}>
        ← Volver al listado
      </Link>

      <div style={encabezado}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>{p.nombre}</h1>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 9px",
            borderRadius: "999px",
            whiteSpace: "nowrap",
            background: INSIGNIA[p.estado].fondo,
            color: INSIGNIA[p.estado].texto,
          }}
        >
          {ETIQUETA[p.estado]}
        </span>
        <code style={{ ...cifra, fontSize: "13px", color: "var(--texto-tenue)" }}>{p.codigo}</code>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href={`/parqueaderos/${p.id}/editar`} style={botonSecundario}>
            Editar datos
          </Link>
          <Link href={`/parqueaderos/${p.id}/estado`} style={botonSecundario}>
            Cambiar estado
          </Link>
          <Link href="/cuentas" style={botonSecundario}>
            Gestionar cuentas
          </Link>
        </div>
      </div>

      {/* Dos columnas: a la izquierda lo que la plataforma administra —los datos
          del establecimiento y lo que se le hizo—, a la derecha su gente y lo
          que el local declaró por su cuenta. `auto-fit` las junta en una sola
          columna cuando no caben, sin punto de quiebre inventado. */}
      <div style={columnas}>
        <div style={pila}>
          <Seccion titulo="Datos del establecimiento">
            <dl style={{ margin: 0 }}>
              <Dato termino="Dirección" valor={p.direccion} />
              <Dato termino="Ciudad" valor={p.ciudad} />
              <Dato termino="Teléfono" valor={p.telefono} mono />
              <Dato termino="Código interno" valor={p.codigo} mono nota="No se puede modificar" />
              <Dato termino="Registrado el" valor={fecha(p.creadoEn)} />
              <Dato termino="Última modificación" valor={fecha(p.actualizadoEn)} ultimo />
            </dl>
          </Seccion>

          <Seccion
            titulo="Historial de estados"
            contador={historial.length}
            vacio="Sin cambios de estado desde que se registró."
          >
            <ol style={lista}>
              {historial.map((h, i) => (
                <li key={i} style={renglon(i === historial.length - 1)}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "14px" }}>
                      {h.estadoAnterior ? `${h.estadoAnterior} → ` : ""}
                      {h.estadoNuevo}
                    </strong>
                    <span style={{ ...cifra, marginLeft: "auto", fontSize: "12px", color: "var(--texto-tenue)" }}>
                      {h.ocurridoEn.toLocaleString("es-CO")}
                    </span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: "13px" }}>{h.motivo}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--texto-tenue)" }}>
                    Ejecutado por {h.ejecutadoPor ?? "—"}
                  </p>
                </li>
              ))}
            </ol>
          </Seccion>
        </div>

        <div style={pila}>
          <Seccion
            titulo="Administradores"
            contador={administradores.length}
            vacio="Este establecimiento no tiene ninguna persona administradora asignada."
          >
            <ListaPersonas personas={administradores} />
          </Seccion>

          <Seccion
            titulo="Operarios"
            contador={operarios.length}
            vacio="Todavía no hay operarios de taquilla en este establecimiento."
          >
            <ListaPersonas personas={operarios} />
          </Seccion>

          {/* Recuadro punteado, no sólido: marca que esto se lee y no se edita
              desde aquí. La frase de abajo dice de quién es la responsabilidad,
              para que nadie busque el botón que no existe. */}
          <section>
            <h2 className="rotulo-filete" style={rotuloSeccion}>Configuración del establecimiento</h2>
            <div style={recuadroPunteado}>
              <Declarado rotulo="Horario" valor={config.horario} />
              <Declarado rotulo="Tarifas" valor={config.tarifas} />
              <Declarado rotulo="Convenios" valor={config.convenios} />
              <Declarado rotulo="Capacidad" valor={config.capacidad} />
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--texto-tenue)" }}>
              La plataforma sólo lee esta configuración: la declara el administrador del
              establecimiento.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function Declarado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <strong style={{ color: "var(--texto)" }}>{rotulo}</strong>
      <br />
      {valor}
    </div>
  );
}

function ListaPersonas({ personas }: { personas: PersonaVinculada[] }) {
  return (
    <ul style={lista}>
      {personas.map((persona, i) => (
        <li key={persona.id} style={renglon(i === personas.length - 1)}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {persona.codigo && (
              <code style={{ ...cifra, fontSize: "12px", fontWeight: 700, color: "var(--acento)" }}>
                {persona.codigo}
              </code>
            )}
            <strong style={{ fontSize: "14px" }}>{persona.nombre}</strong>
            {persona.anonimizada && <Marca fondo="var(--texto-tenue)" texto="#fff" rotulo="Anonimizada" />}
            {persona.bloqueada && !persona.anonimizada && (
              <Marca fondo="#b91c1c" texto="#fff" rotulo="Bloqueada" />
            )}
            {persona.debeCambiarPassword && !persona.anonimizada && (
              <Marca fondo="var(--aviso-fondo)" texto="var(--aviso-texto)" rotulo="Contraseña temporal" />
            )}
          </div>
          <p style={{ margin: "1px 0 0", fontSize: "13px", color: "var(--texto-tenue)" }}>
            {persona.email}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--texto-tenue)" }}>
            Vinculada desde el {fecha(persona.desde)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Marca({ fondo, texto, rotulo }: { fondo: string; texto: string; rotulo: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 8px",
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
  vacio,
  children,
}: {
  titulo: string;
  contador?: number;
  vacio?: string;
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
      <div style={contador === 0 ? { ...tarjeta, padding: "14px 18px" } : tarjeta}>
        {contador === 0 ? (
          <p style={{ margin: 0, color: "var(--texto-tenue)", fontSize: "13px" }}>{vacio}</p>
        ) : (
          children
        )}
      </div>
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
        gap: "16px",
        padding: "8px 0",
        flexWrap: "wrap",
        borderBottom: ultimo ? undefined : "1px solid var(--borde)",
      }}
    >
      <dt style={{ minWidth: "150px", fontSize: "13px", color: "var(--texto-tenue)" }}>{termino}</dt>
      <dd style={{ margin: 0, fontSize: "14px", fontWeight: 500, ...(mono && valor ? cifra : {}) }}>
        {valor || <span style={{ color: "var(--texto-tenue)", fontWeight: 400 }}>Sin registrar</span>}
        {nota && valor && (
          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              fontWeight: 400,
              fontFamily: "inherit",
              color: "var(--texto-tenue)",
            }}
          >
            · {nota}
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
  marginTop: "18px",
  alignItems: "start",
};

const pila: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "18px" };

const tarjeta: React.CSSProperties = {
  borderRadius: "12px",
  padding: "6px 18px",
};

const recuadroPunteado: React.CSSProperties = {
  border: "1px dashed var(--borde)",
  borderRadius: "12px",
  padding: "14px 18px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
  gap: "10px 16px",
  fontSize: "13px",
  color: "var(--texto-tenue)",
};

const lista: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0 };

const renglon = (ultimo: boolean): React.CSSProperties => ({
  padding: "11px 0",
  borderBottom: ultimo ? undefined : "1px solid var(--borde)",
});
