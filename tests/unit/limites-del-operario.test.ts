import { describe, expect, it } from "vitest";
import { puede, type Operacion } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";

/**
 * Hasta dónde llega un operario.
 *
 * Esta prueba es la que de verdad sostiene el límite. Recortar el menú es
 * comodidad —la constitución lo dice con todas sus letras en FR-003:
 * "ocultar una opción en la interfaz NUNCA constituye control de acceso"— y
 * quien escriba la dirección a mano llega igual. Lo que decide es esto.
 */

const operario: Contexto = {
  tipo: "establecimiento",
  usuarioId: "u-op",
  rol: "operario",
  parqueaderoId: "p1",
  estado: "activo",
};

const admin: Contexto = { ...operario, usuarioId: "u-ad", rol: "admin_parqueadero" };

/** Lo que necesita para atender un vehículo. Quitarle una rompe la taquilla. */
const OPERA: Operacion[] = [
  "taquilla.entrada",
  "taquilla.salida",
  "taquilla.consultar",
  // Dejar salir sin cobrar sigue siendo suyo: un turno de noche con un caso
  // legítimo no puede quedar bloqueado hasta que alguien conteste el teléfono.
  // Queda registrado con su nombre, que es lo que lo hace aceptable.
  "taquilla.cortesia",
  "turno.abrir",
  // Leer tarifas, convenios y la política de cobro: la taquilla las usa en
  // cada vehículo, y además le permiten responder "¿cuánto me cuesta?".
  "parqueadero.ver.propio",
];

/** Lo que NO es suyo. */
const NO_OPERA: Operacion[] = [
  "establecimiento.administrar.ver",
  "parqueadero.editar.propio",
  "cuenta.crear.propia",
  "cuenta.gestionar.propia",
  "ficha.declarar",
  "delegacion.otorgar",
  // Por rol no; un administrador puede delegársela a una persona concreta.
  "movimiento.corregir",
];

describe("un operario", () => {
  it.each(OPERA)("puede %s, que necesita para atender", (op) => {
    expect(puede(operario, op)).toBe(true);
  });

  it.each(NO_OPERA)("no puede %s", (op) => {
    expect(puede(operario, op)).toBe(false);
  });

  it("no abre las pantallas de administración del establecimiento", () => {
    // Es lo que cierra Mi parqueadero, Horario, Turnos y Operarios. Esa última
    // importa especialmente: trae el correo de cada compañero, quién está
    // bloqueado y quién sigue con contraseña temporal.
    expect(puede(operario, "establecimiento.administrar.ver")).toBe(false);
    expect(puede(admin, "establecimiento.administrar.ver")).toBe(true);
  });

  it("conserva la lectura que la taquilla necesita", () => {
    // `parqueadero.ver.propio` NO se le quitó, y es deliberado: la usan las
    // tarifas, los convenios y la política de cobro que la taquilla consulta
    // en cada vehículo. Quitársela habría roto la pantalla entera.
    expect(puede(operario, "parqueadero.ver.propio")).toBe(true);
  });
});

describe("un administrador del establecimiento", () => {
  it("puede además todo lo que puede un operario", () => {
    // Hay parqueaderos donde el administrador atiende en taquilla, y obligarlo
    // a tener dos cuentas para cobrar un carro sería absurdo.
    for (const op of OPERA) expect(puede(admin, op), op).toBe(true);
  });

  it("administra lo que el operario no", () => {
    for (const op of NO_OPERA.filter((o) => o !== "movimiento.corregir")) {
      expect(puede(admin, op), op).toBe(true);
    }
  });
});
