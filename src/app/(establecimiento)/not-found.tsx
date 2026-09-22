import Link from "next/link";
import {
  PantallaDeAviso,
  TarjetaDeAviso,
  accionPrincipal,
  accionSecundaria,
} from "@/app/pantalla-aviso";

export const metadata = { title: "Fuera de su alcance" };

/**
 * Fuera de alcance (maqueta 11c).
 *
 * **Es el `not-found` del área del establecimiento, y eso no es un detalle de
 * implementación: es lo que hace que la pantalla sea legal.** FR-011 exige que
 * "este recurso no existe" y "este recurso es de otro establecimiento" sean
 * INDISTINGUIBLES —si difirieran, probando identificadores se averiguaría
 * cuáles existen, que es la fuga que el Principio I evita en la capa de datos—.
 * Colgándola del segmento, las dos causas desembocan acá y responden igual.
 *
 * **Desvío anotado respecto de la maqueta.** El handoff la titula "Este recurso
 * no le pertenece" y dice "este dato es de otro". Esas dos frases AFIRMAN que
 * el recurso existe, que es justo lo que no se puede revelar; y serían mentira
 * cuando el identificador simplemente no existe. La maqueta ya intuía la
 * tensión —su propio párrafo dice "el sistema responde igual aunque el
 * identificador exista"—, así que se conserva la composición, la insignia y el
 * argumento, y se corrige el título para que no asegure nada que no se sabe.
 */
export default function FueraDeAlcance() {
  return (
    <PantallaDeAviso
      ancho={540}
      acciones={
        <>
          <Link href="/establecimiento" style={accionPrincipal}>
            Volver a mi parqueadero
          </Link>
          <Link href="/taquilla" style={accionSecundaria}>
            Ir a la taquilla
          </Link>
        </>
      }
    >
      <TarjetaDeAviso
        tono="aviso"
        insignia="Fuera de su alcance"
        titulo="Este recurso no está a su alcance"
      >
        Su cuenta trabaja en un solo establecimiento, y esto no está en él. No es un error
        suyo: el sistema responde igual exista o no el identificador, para no revelar de quién
        es.
        <p style={{ margin: "14px 0 0", fontSize: "13px" }}>
          El intento queda registrado en la auditoría de la plataforma.
        </p>
      </TarjetaDeAviso>
    </PantallaDeAviso>
  );
}
