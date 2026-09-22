import { headers } from "next/headers";
import { botonSecundario, rotuloSeccion, textoTenue } from "@/app/ui";
import { cerrarSesion } from "@/app/(auth)/login/acciones";
import { contextoActual } from "@/lib/sesion";
import { identidadVisible } from "@/dominio/cuentas/identidad";

/**
 * Quién está usando el sistema, y cómo salir.
 *
 * Vive en las pantallas de ajustes y no sólo en la barra lateral porque en el
 * teléfono esa barra es una fila de pestañas abajo y no tiene dónde poner un
 * pie: sin esto, quien entra desde el celular no tendría cómo cerrar sesión.
 *
 * En el computador se llega por los dos sitios, y eso no sobra: cerrar sesión
 * es una acción que se busca cuando se necesita, no algo que se memorice.
 *
 * Compartida entre la plataforma y el establecimiento porque el problema es el
 * mismo en las dos; dos copias se separarían con el tiempo y una acabaría
 * quedándose sin la salida.
 */
export async function SeccionDeCuenta() {
  const contexto = await contextoActual(await headers()).catch(() => null);
  if (!contexto) return null;

  const quien = await identidadVisible(contexto);

  return (
    <section style={{ marginTop: "26px", maxWidth: "26rem" }}>
      <h2 className="rotulo-filete" style={rotuloSeccion}>Su cuenta</h2>
      <div
        style={{
                  borderRadius: "14px",
          background: "var(--superficie)",
          padding: "16px 20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>{quien.nombre}</p>
        <p style={{ ...textoTenue, margin: "2px 0 14px" }}>{quien.rol}</p>

        <form action={cerrarSesion}>
          <button type="submit" style={botonSecundario}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </section>
  );
}
