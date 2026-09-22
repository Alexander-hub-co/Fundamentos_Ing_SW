import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(establecimiento)/configuracion/turnos/acciones", () => ({
  accionSobreTurnos: async () => ({}),
}));

const { PanelTurnos } = await import("@/app/(establecimiento)/configuracion/turnos/panel");
type Turno = Parameters<typeof PanelTurnos>[0]["turnos"][number];

/**
 * El cuadrante semanal de turnos.
 *
 * La maqueta marca cada día con un punto: dice que ese día se trabaja, y para
 * saber quién hay que volver a la columna de la izquierda. Poniendo el nombre
 * en la celda, la rejilla contesta sola la pregunta que se le hace —"¿quién
 * está el martes por la mañana?"—.
 */
const persona = (id: string, nombre: string) => ({ id, nombre, codigo: null });

function turno(p: Partial<Turno> & { id: string; nombre: string }): Turno {
  return {
    horaInicio: "07:00:00",
    horaFin: "15:00:00",
    activo: true,
    dias: [1, 2, 3, 4, 5],
    personas: [],
    ...p,
  } as Turno;
}

const dibujar = (
  turnos: Turno[],
  gente: ReturnType<typeof persona>[] = [],
  sinCubrir: string[] = [],
  huecosDeMas = 0,
) =>
  renderToStaticMarkup(
    <PanelTurnos turnos={turnos} gente={gente} sinCubrir={sinCubrir} huecosDeMas={huecosDeMas} />,
  );

describe("el cuadrante", () => {
  const MANANA = turno({
    id: "t1",
    nombre: "Mañana",
    personas: [persona("u1", "Juan Pérez"), persona("u2", "Sandra Villa")],
  });

  it("pone el NOMBRE en cada día que se trabaja, no un punto", () => {
    const html = dibujar([MANANA]);
    expect(html).toContain("turnos-nombre");
    // Cinco días laborables × dos personas.
    expect((html.match(/turnos-nombre/g) ?? []).length).toBe(10);
  });

  it("usa el nombre de pila, que es como se llama la gente en una caseta", () => {
    const html = dibujar([MANANA]);
    expect(html).toContain(">Juan<");
    expect(html).toContain(">Sandra<");
    // El apellido no cabe siete veces a lo ancho.
    expect(html).not.toContain("Juan Pérez</span>");
  });

  it("desambigua sólo cuando dos del mismo turno comparten nombre de pila", () => {
    const dos = turno({
      id: "t2",
      nombre: "Tarde",
      personas: [persona("u1", "Juan Pérez"), persona("u2", "Juan Gómez")],
    });
    const html = dibujar([dos]);
    expect(html).toContain("Juan P.");
    expect(html).toContain("Juan G.");
  });

  it("no repite la lista de gente en la columna del turno", () => {
    // Estaba en los dos sitios: decir dos veces lo mismo en la misma fila.
    const html = dibujar([MANANA]);
    const columna = html.slice(html.indexOf("turnos-turno"), html.indexOf("turnos-celda"));
    expect(columna).not.toContain("Sandra");
  });

  it("un día libre se dibuja vacío, pero dice que es libre al lector", () => {
    const html = dibujar([MANANA]);
    expect(html).toContain("Dom: libre");
    expect(html).toContain("Sáb: libre");
  });

  it("un turno marcado sin nadie asignado avisa, en vez de fingir que está cubierto", () => {
    const html = dibujar([turno({ id: "t3", nombre: "Noche" })]);
    expect(html).toContain("turnos-vacante");
  });
});

describe("la gestión", () => {
  const MANANA = turno({ id: "t1", nombre: "Mañana", personas: [persona("u1", "Juan Pérez")] });

  it("no lista los turnos dos veces", () => {
    // Había una segunda seccion, "Gestión de cada turno", que repetía los
    // mismos turnos en tarjetas debajo del cuadrante.
    const html = dibujar([MANANA]);
    expect((html.match(/Mañana/g) ?? []).length).toBe(1);
  });

  it("guarda las acciones detrás de Gestionar", () => {
    const html = dibujar([MANANA]);
    expect(html).toContain("Gestionar");
    expect(html).not.toContain("Desactivar el turno");
    expect(html).not.toContain("Asignar a alguien");
  });

  it("el botón que retira a alguien dice que lo retira", () => {
    // Su nombre accesible era el de la persona más "— retirar" pegado.
    const fuente = require("node:fs").readFileSync(
      "src/app/(establecimiento)/configuracion/turnos/panel.tsx",
      "utf8",
    );
    expect(fuente).toContain("aria-label={`Retirar a ${persona.nombre} del turno ${t.nombre}`}");
  });
});

describe("un turno desactivado", () => {
  it("no se atenúa con opacidad, que hunde el contraste del texto tenue", () => {
    const html = dibujar([turno({ id: "t4", nombre: "Viejo", activo: false })]);
    expect(html).toContain("data-inactivo");
    expect(html).not.toContain("opacity:0.5");
  });
});

describe("los textos que sobraban", () => {
  const MANANA = turno({ id: "t1", nombre: "Mañana", personas: [persona("u1", "Juan Pérez")] });

  it("no queda la leyenda de los puntos, que ya no existen", () => {
    // Explicaba "punto verde" y "punto azul". Una leyenda que describe una
    // codificación retirada confunde más que la ausencia de leyenda.
    const html = dibujar([MANANA]);
    expect(html).not.toContain("Punto verde");
    expect(html).not.toContain("Punto azul");
  });

  it("las horas sin cubrir van al PIE, no delante del cuadrante", () => {
    // Avisa, no impide. Quien entra viene a ver o a tocar el cuadrante.
    const html = dibujar([MANANA], [], ["domingo de 07:00 a. m. a 08:00 p. m."]);
    expect(html.indexOf("turnos-cuadrante")).toBeLessThan(html.indexOf("Horas sin cubrir"));
  });

  it("las franjas van una por renglón, no encadenadas con puntos medios", () => {
    const html = dibujar([MANANA], [], [
      "domingo de 07:00 a. m. a 08:00 p. m.",
      "lunes de 03:00 p. m. a 08:00 p. m.",
    ]);
    expect(html).toContain("turnos-huecos");
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).not.toContain("p. m. · lunes");
  });

  it("no dibuja la sección cuando no hay ningún hueco", () => {
    expect(dibujar([MANANA])).not.toContain("Horas sin cubrir");
  });
});
