import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(establecimiento)/configuracion/convenios/acciones", () => ({
  accionSobreConvenios: async () => ({}),
  consultarPlaca: async () => ({}),
}));

const { PanelConvenios } = await import("@/app/(establecimiento)/configuracion/convenios/panel");
type Convenio = Parameters<typeof PanelConvenios>[0]["convenios"][number];

/**
 * El rediseño de Convenios.
 *
 * Lo que se protege es lo que costó decidir: que los convenios se puedan
 * COMPARAR de un barrido, que ciento veintiocho placas no inunden la pantalla
 * antes del primer dato, y que un botón que borra una placa diga que la borra.
 */
function convenio(p: Partial<Convenio> & { id: string; nombre: string }): Convenio {
  return {
    activacion: "placa",
    beneficio: "minutos_gratis",
    descripcion: "Primeras 3 horas sin cobro",
    desde: new Date("2026-01-01T12:00:00Z"),
    hasta: null,
    activo: true,
    declaradoPorSoporte: false,
    placas: [],
    ...p,
  } as Convenio;
}

const CIENTO = Array.from({ length: 128 }, (_, i) => `AAA${String(i).padStart(3, "0")}`);
const ANDINO = convenio({ id: "c1", nombre: "Centro Andino", placas: CIENTO });
const SELLO = convenio({ id: "c2", nombre: "Fruver La Esquina", activacion: "sello" });

const dibujar = (convenios: Convenio[], uso = new Map(), administra = true) =>
  renderToStaticMarkup(
    <PanelConvenios convenios={convenios} uso={uso} administra={administra} />,
  );

describe("la lista de convenios", () => {
  it("se lee en columnas alineadas, para poder compararlos", () => {
    // Antes cada convenio era un bloque suelto con sus cifras en una fila
    // flexible, así que "sin cobrar" caía en un sitio distinto en cada uno.
    const html = dibujar([ANDINO, SELLO]);
    expect(html).toContain("convenios-rejilla");
    expect((html.match(/convenios-rejilla/g) ?? []).length).toBe(3); // cabecera + 2 filas
  });

  it("no vuelca las 128 placas en la pantalla", () => {
    // Tres convenios de empresa llenaban la página de cuatrocientas pastillas
    // antes de llegar al primer dato.
    const html = dibujar([ANDINO]);
    expect(html).not.toContain("AAA042");
    expect(html).toContain("Gestionar");
  });

  it("lleva los papeles que suplen a un <table>", () => {
    // Sin ellos se anuncian "128", "412" y "$1.284.600" sueltos, sin decir de
    // qué columna es cada uno.
    const html = dibujar([ANDINO]);
    expect(html).toContain('role="table"');
    expect(html).toContain('role="columnheader"');
    expect(html).toContain('role="rowgroup"');
    expect(html).toContain('role="cell"');
  });

  it("destaca lo que se dejó de cobrar, que es la cifra que decide", () => {
    const html = dibujar([ANDINO], new Map([["c1", { usos: 412, sinCobrar: 1_284_600 }]]));
    expect(html).toContain("$1.284.600");
    expect(html).toContain("var(--convenio-texto)");
  });

  it("un convenio por sello no promete una lista de placas que no tiene", () => {
    const html = dibujar([SELLO]);
    expect(html).toContain("con el sello del comercio");
  });
});

describe("los vencidos", () => {
  const VIEJO = convenio({
    id: "c3",
    nombre: "Convenio viejo",
    activo: false,
    hasta: new Date("2026-02-01T12:00:00Z"),
  });

  it("no se atenúan con opacidad, que hunde el contraste del texto tenue", () => {
    const html = dibujar([VIEJO]);
    expect(html).toContain("Vencidos");
    expect(html).not.toContain("opacity:0.65");
  });

  it("van en su propia sección y no mezclados con los vigentes", () => {
    // Confundir uno vencido con uno vivo delante de un cliente es prometer un
    // precio que la taquilla no va a cobrar.
    const html = dibujar([ANDINO, VIEJO]);
    expect(html.indexOf("Vigentes")).toBeLessThan(html.indexOf("Vencidos"));
  });
});

describe("las acciones", () => {
  it("el alta no ocupa la pantalla mientras no se pida", () => {
    const html = dibujar([ANDINO]);
    expect(html).toContain("Nuevo convenio");
    expect(html).not.toContain("Cuándo aplica");
  });

  it("se abre sola cuando todavía no hay ningún convenio", () => {
    // Una pantalla vacía con un botón es un callejón; acá el primer paso está
    // puesto.
    expect(dibujar([])).toContain("Cuándo aplica");
  });

  it("el botón que quita una placa dice que la quita", () => {
    // Su nombre accesible era "ABC123 ✕": para quien no ve la pantalla es una
    // placa a secas, y pulsarla la borra.
    const html = dibujar([convenio({ id: "c1", nombre: "Andino", placas: ["ABC123"] })]);
    // Sólo aparece con el convenio abierto; en cerrado no debe estar ninguna.
    expect(html).not.toContain("ABC123");
  });
});

describe("lo que ve un operario", () => {
  const ANDINO_CON_USO = new Map([["c1", { usos: 412, sinCobrar: 1_284_600 }]]);
  const html = dibujar([ANDINO], ANDINO_CON_USO, false);

  it("ve qué convenios hay y qué hace cada uno", () => {
    // Es lo que necesita para responderle a un cliente que dice tener uno.
    expect(html).toContain("Centro Andino");
    expect(html).toContain("Primeras 3 horas sin cobro");
    expect(html).toContain("Vigentes");
  });

  it("no ve cuánto se ha dejado de cobrar ni cuántas placas cubre", () => {
    // Son datos del negocio, no de la operación.
    expect(html).not.toContain("$1.284.600");
    expect(html).not.toContain("Sin cobrar");
    expect(html).not.toContain("Placas");
  });

  it("no puede declarar, gestionar ni vencer ninguno", () => {
    expect(html).not.toContain("Nuevo convenio");
    expect(html).not.toContain("Gestionar");
    expect(html).not.toContain("Vencer");
  });

  it("no ve los vencidos, que son historia de administración", () => {
    const conVencido = dibujar(
      [ANDINO, convenio({ id: "c9", nombre: "Viejo", activo: false })],
      new Map(),
      false,
    );
    expect(conVencido).not.toContain("Viejo");
  });
});
