import { normalizarPlaca } from "./placa";

/**
 * De qué tipo es un vehículo, según su placa.
 *
 * PURO: no importa nada de `src/db` salvo nada en absoluto, no lee el reloj y no
 * consulta. Vive aislado porque la constitución lo exige con esas palabras: la
 * regla NO puede estar dispersa en la interfaz, y debe poder cambiar sin tocar
 * el flujo de registro.
 *
 * LA REGLA, que fija la constitución: si la placa termina en dígito es carro, si
 * termina en letra es moto. En Colombia las placas de carro son tres letras y
 * tres números; las de moto, tres letras y dos números más una letra.
 *
 * Y lo que NO hace, que importa igual: no adivina. Una placa que no tiene forma
 * de placa se rechaza para que quien atiende la corrija. Clasificar por defecto
 * metería un vehículo con la tarifa equivocada, y eso se descubre al cobrar,
 * con el cliente delante.
 */

export type ClaseDeVehiculo = "carro" | "moto";

export type Clasificacion =
  | { tipo: "reconocida"; clase: ClaseDeVehiculo; placa: string }
  | { tipo: "rechazada"; motivo: string };

/**
 * El puente entre la regla y el catálogo.
 *
 * La regla habla de carros y motos; el sistema trabaja con tipos del catálogo,
 * que se identifican por código. Ésta es la ÚNICA correspondencia entre los dos
 * mundos, y está sola para que cambiar la regla mañana no obligue a buscarla
 * por media aplicación.
 */
export const CODIGO_DE_CLASE: Record<ClaseDeVehiculo, string> = {
  carro: "automovil",
  moto: "motocicleta",
};

export function clasificarPorPlaca(bruta: string): Clasificacion {
  const placa = normalizarPlaca(bruta);

  if (placa.length === 0) {
    return { tipo: "rechazada", motivo: "Escriba una placa" };
  }
  if (placa.length < 5 || placa.length > 8) {
    return {
      tipo: "rechazada",
      motivo: `«${placa}» no tiene forma de placa. Revísela y vuelva a escribirla`,
    };
  }

  const ultimo = placa.at(-1)!;

  // El último carácter decide, y sólo puede ser una de dos cosas porque la
  // normalización ya dejó únicamente letras y dígitos.
  return {
    tipo: "reconocida",
    clase: ultimo >= "0" && ultimo <= "9" ? "carro" : "moto",
    placa,
  };
}
