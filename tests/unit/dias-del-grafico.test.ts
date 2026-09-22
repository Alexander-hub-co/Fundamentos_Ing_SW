import { describe, expect, it } from "vitest";
import { diasDe, rangoDe } from "@/dominio/reportes/rangos";

/**
 * El gráfico de barras cubre el período ENTERO.
 *
 * El fallo que motivó estas pruebas: el día mostraba una sola barra y la
 * semana sólo las jornadas ya transcurridas, así que un martes la semana
 * parecía tener dos días. Se veía, en palabras de quien lo reportó, "trabado".
 */
describe("los días que dibuja el gráfico", () => {
  // Miércoles 12 de agosto de 2026, media tarde en Bogotá.
  const MIERCOLES = new Date("2026-08-12T20:00:00Z");

  it("no devuelve ninguno para el día ni el turno: una sola barra no compara con nada", () => {
    expect(diasDe("dia", rangoDe("dia", MIERCOLES))).toHaveLength(0);
    // El turno no pasa por `rangoDe`: su rango lo fija la apertura de la caja.
    expect(diasDe("turno", rangoDe("dia", MIERCOLES))).toHaveLength(0);
  });

  it("devuelve la semana completa aunque falten días por transcurrir", () => {
    const dias = diasDe("semana", rangoDe("semana", MIERCOLES));
    expect(dias).toHaveLength(7);
  });

  it("devuelve el mes completo, con los días que tenga ese mes", () => {
    expect(diasDe("mes", rangoDe("mes", MIERCOLES))).toHaveLength(31);

    // Febrero de 2027 no es bisiesto; febrero de 2028 sí.
    expect(diasDe("mes", rangoDe("mes", new Date("2027-02-10T17:00:00Z")))).toHaveLength(28);
    expect(diasDe("mes", rangoDe("mes", new Date("2028-02-10T17:00:00Z")))).toHaveLength(29);
  });

  it("empieza donde empieza el rango y avanza de a un día", () => {
    const rango = rangoDe("semana", MIERCOLES);
    const dias = diasDe("semana", rango);

    expect(dias[0]!.getTime()).toBe(rango.desde.getTime());
    for (let i = 1; i < dias.length; i++) {
      expect(dias[i]!.getTime() - dias[i - 1]!.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });
});
