import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// La acción del servidor no se ejecuta acá: se dibuja el formulario, no se
// envía. Sin este doble, importar el panel arrastraría la conexión a la base.
vi.mock("@/app/(establecimiento)/equipo/acciones", () => ({
  accionSobreEquipo: async () => ({}),
}));

const { PanelEquipo } = await import("@/app/(establecimiento)/equipo/panel");
type Miembro = Parameters<typeof PanelEquipo>[0]["equipo"][number];

/**
 * La forma de la pantalla de operarios.
 *
 * Lo que se protege es lo que el rediseño vino a arreglar y que un cambio
 * distraído volvería a romper: que cada persona aparezca UNA vez, que sus
 * acciones estén guardadas hasta que se pidan, y que nadie pueda gestionarse
 * a sí mismo.
 */
function miembro(parcial: Partial<Miembro> & { id: string; nombre: string }): Miembro {
  return {
    codigo: "OP-01",
    email: "alguien@parquivo.co",
    rol: "operario",
    bloqueada: false,
    motivoBloqueo: null,
    debeCambiarPassword: false,
    anonimizadaEn: null,
    vendido: 0,
    turnos: [],
    enTurno: false,
    ...parcial,
  };
}

const JUAN = miembro({ id: "u1", nombre: "Juan Pérez", codigo: "OP-04", vendido: 2_788_800 });
const SANDRA = miembro({ id: "u2", nombre: "Sandra Villa", codigo: "OP-06", bloqueada: true });
const YO = miembro({ id: "admin", nombre: "Marcela Ospina", rol: "admin_parqueadero" });

function dibujar(equipo: Miembro[], puedenCorregir: string[] = []) {
  return renderToStaticMarkup(
    <PanelEquipo equipo={equipo} yo="admin" esAdministrador puedenCorregir={puedenCorregir} />,
  );
}

describe("la pantalla de operarios", () => {
  it("nombra a cada persona una sola vez", () => {
    const html = dibujar([YO, JUAN, SANDRA]);
    expect(html.split("Juan Pérez")).toHaveLength(2);
  });

  it("guarda las acciones detrás de Gestionar en vez de mostrarlas todas", () => {
    const html = dibujar([YO, JUAN]);
    expect(html).toContain("Gestionar");
    expect(html).not.toContain("Pasar a operario");
    expect(html).not.toContain("Dar de baja");
  });

  it("no ofrece Gestionar sobre la propia cuenta", () => {
    // Sólo la del administrador que mira: nadie se bloquea ni se degrada solo.
    expect(dibujar([YO])).not.toContain("Gestionar");
    expect(dibujar([YO, JUAN])).toContain("Gestionar");
  });

  it("sube arriba lo que requiere atención, con el remedio al lado", () => {
    const html = dibujar([YO, SANDRA]);
    expect(html).toContain("Requiere atención");
    expect(html).toContain("El bloqueo no vence solo");
    expect(html).toContain("Desbloquear");
  });

  it("no habla de atención cuando no hay nada que atender", () => {
    expect(dibujar([YO, JUAN])).not.toContain("Requiere atención");
  });

  it("escribe lo vendido y además lo dibuja, sin repetirlo en otro panel", () => {
    const html = dibujar([YO, JUAN]);
    expect(html).toContain("$2.788.800");
    expect(html).toContain("equipo-barra");
    expect(html).not.toContain("Vendido en los últimos 7 días");
  });

  it("dice quién corrige cobros junto a su rol, no en la columna de estado", () => {
    const html = dibujar([YO, JUAN], [JUAN.id]);
    expect(html).toContain("corrige cobros");
  });
});
